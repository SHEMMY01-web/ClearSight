import pandas as pd
import json
import os
import time
import re
from google import genai
from google.genai import types
from dotenv import load_dotenv

# Load environment variables (mostly for GEMINI_API_KEY)
load_dotenv(dotenv_path='../.env')

API_KEY = os.getenv('GEMINI_API_KEY')
if not API_KEY:
    raise ValueError("GEMINI_API_KEY is not set in ../.env")

# Initialize Gemini Client
client = genai.Client(api_key=API_KEY)
MODEL_ID = 'gemini-2.5-flash'
EMBEDDING_MODEL_ID = 'text-embedding-004'

def extract_case_details_with_llm(offence, decision):
    prompt = f"""
    You are a legal data extractor. Analyze the following court case details:
    Offence: "{offence}"
    Decision: "{decision}"
    -;
    
    Extract the following information and return ONLY a valid JSON object with these exact keys:
    {{
      "Business_Category": "One of: Criminal, Real Estate & Tenancy, Labour & Employment, Liability & Risk, General Commercial, Other",
      "Outcome": "WON or LOST (From the perspective of the business/appellant/defendant against the state)",
      "Year": "Extract the year from the text (e.g., 2021) if present, otherwise 'N/A'",
      "Summary": "A concise 1-sentence summary of the case and its result"
    }}
    Ensure the output is pure JSON. Do not include markdown code block syntax (like ```json).
    """
    try:
        response = client.models.generate_content(
            model=MODEL_ID,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.1
            )
        )
        text = response.text.strip()
        # Clean markdown if present
        if text.startswith('```json'):
            text = text[7:]
        if text.endswith('```'):
            text = text[:-3]
            
        return json.loads(text.strip())
    except Exception as e:
        print(f"Error during LLM extraction: {e}")
        return None

def generate_embedding(text):
    try:
        response = client.models.embed_content(
            model=EMBEDDING_MODEL_ID,
            contents=text
        )
        # GenAI Python SDK returns an object with `embeddings` property.
        return response.embeddings[0].values
    except Exception as e:
        print(f"Error during embedding generation: {e}")
        return None

def main():
    print("🚀 Starting Foresight ETL Pipeline...")
    try:
        df = pd.read_excel('scn_appeal_cases_data.xlsx')
    except Exception as e:
        print(f"Failed to load Excel file: {e}")
        return

    print(f"Loaded {len(df)} cases from Excel.")
    
    # We will process a subset if the file is massive to avoid high API costs during dev
    # Assuming this dataset is small (e.g. 50-100 rows). 
    # For production, we'll process all of them.
    max_cases = 100
    df_subset = df.head(max_cases).copy()
    
    processed_cases = []
    
    for index, row in df_subset.iterrows():
        offence = str(row.get('offence', ''))
        decision = str(row.get('scn_decision', ''))
        
        print(f"Processing case {index + 1}/{len(df_subset)}...")
        
        # 1. AI Categorization & Extraction
        extracted_data = extract_case_details_with_llm(offence, decision)
        time.sleep(1) # Basic rate limiting
        
        if not extracted_data:
            continue
            
        category = extracted_data.get('Business_Category', 'Other')
        outcome = extracted_data.get('Outcome', 'LOST')
        year = extracted_data.get('Year', 'N/A')
        summary = extracted_data.get('Summary', '')
        
        # We drop criminal/other cases from the RAG db as per previous logic
        if category in ['CRIMINAL', 'Other']:
            continue
            
        # 2. Vector Embedding Generation
        # We embed the offence + summary for rich semantic retrieval
        embed_text = f"Legal issue: {offence}. Context: {summary}"
        vector = generate_embedding(embed_text)
        time.sleep(0.5) # Basic rate limiting
        
        if not vector:
            continue
            
        processed_cases.append({
            "id": f"case_{index}",
            "Offence Description": offence,
            "Business_Category": category,
            "Outcome": outcome,
            "Year": year,
            "Summary": summary,
            "embedding": vector
        })

    print(f"Successfully processed {len(processed_cases)} valid business cases.")
    
    output_file = 'foresight_vectors_v2.json'
    with open(output_file, 'w') as f:
        json.dump(processed_cases, f, indent=2)
        
    print(f"✅ Materialized data and vectors saved to {output_file}")

if __name__ == "__main__":
    main()
