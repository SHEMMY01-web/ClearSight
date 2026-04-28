import pandas as pd
import json
import warnings
warnings.filterwarnings('ignore')

df = pd.read_excel('scn_appeal_cases_data.xlsx')

def map_category(offence):
    offence = str(offence).lower()
    
    # Criminal
    if 'murder' in offence or 'robbery' in offence or 'rape' in offence:
        return 'CRIMINAL'
        
    # Real Estate & Tenancy
    if 'claim_for_recovery' in offence or 'civil_petition' in offence or 'trespassing' in offence:
        return 'Real Estate & Tenancy'
        
    # Labour & Employment
    if 'termination' in offence:
        return 'Labour & Employment'
        
    # Liability & Risk
    if 'tort' in offence or 'damage' in offence:
        return 'Liability & Risk'
        
    # General Commercial
    if 'dispute' in offence:
        return 'General Commercial'
        
    return 'Other'

df['Business_Category'] = df['offence'].apply(map_category)

# Filter out Criminal and Other
df_mapped = df[(df['Business_Category'] != 'CRIMINAL') & (df['Business_Category'] != 'Other')].copy()

# Outcome Decoding
def decode_outcome(decision):
    decision = str(decision).lower()
    if 'granted' in decision or 'approved' in decision or 'allowed' in decision:
        return 'WON'
    return 'LOST'

df_mapped['Outcome'] = df_mapped['scn_decision'].apply(decode_outcome)

# Summary table: Win Rate (% Appeals Allowed)
df_mapped['Won_Num'] = df_mapped['Outcome'].apply(lambda x: 1 if x == 'WON' else 0)
summary = df_mapped.groupby('Business_Category').agg(
    Total_Appeals=('Outcome', 'count'),
    Wins=('Won_Num', 'sum')
)
summary['Win Rate (%)'] = ((summary['Wins'] / summary['Total_Appeals']) * 100).round(2)

print(summary.to_markdown())

# Export JSON
export_df = df_mapped[['offence', 'Outcome']].rename(columns={'offence': 'Offence Description'})
export_df['Year'] = 'N/A'  # Year column missing from dataset
export_list = export_df.to_dict(orient='records')

with open('foresight_vectors.json', 'w') as f:
    json.dump(export_list, f, indent=2)
