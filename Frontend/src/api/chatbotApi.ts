import axiosClient from './axiosClient';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const chatbotApi = {
  sendMessage: (message: string, history: ChatMessage[] = []) =>
    axiosClient.post('/chatbot/message', { message, history }),
};
