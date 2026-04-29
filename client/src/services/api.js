import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
});

export const uploadContract = async (file, persona = 'general', strategySettings = null) => {
  const formData = new FormData();
  formData.append('contract', file);
  formData.append('persona', persona);
  if (strategySettings) {
    formData.append('strategySettings', JSON.stringify(strategySettings));
  }

  try {
    const response = await api.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || 'Failed to upload contract');
  }
};
