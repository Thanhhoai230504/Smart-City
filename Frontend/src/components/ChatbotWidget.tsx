import React, { useState, useRef, useEffect } from 'react';
import {
  Box, IconButton, Typography, TextField, Stack, Paper, Chip, Avatar, Fade, Zoom,
} from '@mui/material';
import { Close, Send, SmartToy, Person } from '@mui/icons-material';
import { chatbotApi } from '../api/chatbotApi';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const QUICK_ACTIONS = [
  { label: '📝 Cách báo cáo sự cố', msg: 'Hướng dẫn tôi cách báo cáo sự cố' },
  { label: '📊 Thống kê sự cố', msg: 'Cho tôi xem thống kê sự cố hiện tại' },
  { label: '🗺️ Hướng dẫn dùng bản đồ', msg: 'Hướng dẫn sử dụng bản đồ' },
  { label: '❓ Liên hệ hỗ trợ', msg: 'Tôi muốn liên hệ hỗ trợ' },
];

const ChatbotWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Xin chào! 👋 Tôi là trợ lý AI của Smart City Đà Nẵng. Tôi có thể giúp bạn báo cáo sự cố, tra cứu thông tin hoặc hướng dẫn sử dụng hệ thống. Bạn cần hỗ trợ gì?' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: 'user', content: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const { data } = await chatbotApi.sendMessage(text.trim(), [...messages, userMsg]);
      setMessages(prev => [...prev, { role: 'assistant', content: data.data.reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Xin lỗi, tôi gặp lỗi. Vui lòng thử lại.' }]);
    }
    setLoading(false);
  };

  return (
    <>
      {/* Floating Button */}
      <Zoom in={!isOpen}>
        <IconButton
          onClick={() => setIsOpen(true)}
          sx={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 1300,
            width: 56, height: 56,
            background: 'linear-gradient(135deg, #6C63FF, #3B82F6)',
            color: '#fff', boxShadow: '0 4px 20px rgba(108,99,255,0.4)',
            '&:hover': { background: 'linear-gradient(135deg, #5A52D5, #2563EB)', transform: 'scale(1.1)' },
            transition: 'all 0.3s',
          }}
        >
          <SmartToy />
        </IconButton>
      </Zoom>

      {/* Chat Panel */}
      <Fade in={isOpen}>
        <Paper sx={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 1300,
          width: { xs: 'calc(100vw - 32px)', sm: 380 }, height: { xs: 480, sm: 520 },
          borderRadius: '16px', overflow: 'hidden', display: isOpen ? 'flex' : 'none',
          flexDirection: 'column',
          bgcolor: 'rgba(17,24,39,0.97)', backdropFilter: 'blur(20px)',
          border: '1px solid rgba(108,99,255,0.2)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
          {/* Header */}
          <Stack direction="row" alignItems="center" justifyContent="space-between"
            sx={{ px: 2, py: 1.5, background: 'linear-gradient(135deg, #6C63FF, #3B82F6)' }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <SmartToy sx={{ fontSize: 22 }} />
              <Box>
                <Typography fontWeight={700} fontSize={14} color="#fff">Trợ lý AI Đà Nẵng</Typography>
                <Typography fontSize={10} color="rgba(255,255,255,0.7)">Smart City Dashboard</Typography>
              </Box>
            </Stack>
            <IconButton size="small" onClick={() => setIsOpen(false)} sx={{ color: '#fff' }}>
              <Close fontSize="small" />
            </IconButton>
          </Stack>

          {/* Messages */}
          <Box sx={{
            flex: 1, overflowY: 'auto', px: 2, py: 1.5,
            '&::-webkit-scrollbar': { width: 4 },
            '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 2 },
          }}>
            {messages.map((msg, i) => (
              <Stack key={i} direction="row" justifyContent={msg.role === 'user' ? 'flex-end' : 'flex-start'}
                sx={{ mb: 1.5 }}>
                {msg.role === 'assistant' && (
                  <Avatar sx={{ width: 28, height: 28, mr: 1, bgcolor: '#6C63FF', fontSize: 14 }}>
                    <SmartToy sx={{ fontSize: 16 }} />
                  </Avatar>
                )}
                <Box sx={{
                  maxWidth: '78%', px: 1.5, py: 1, borderRadius: '12px',
                  bgcolor: msg.role === 'user' ? 'rgba(108,99,255,0.2)' : 'rgba(255,255,255,0.06)',
                  border: msg.role === 'user' ? '1px solid rgba(108,99,255,0.3)' : '1px solid rgba(255,255,255,0.06)',
                }}>
                  <Typography variant="body2" fontSize={13} sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                    {msg.content}
                  </Typography>
                </Box>
                {msg.role === 'user' && (
                  <Avatar sx={{ width: 28, height: 28, ml: 1, bgcolor: '#3B82F6', fontSize: 14 }}>
                    <Person sx={{ fontSize: 16 }} />
                  </Avatar>
                )}
              </Stack>
            ))}
            {loading && (
              <Stack direction="row" sx={{ mb: 1.5 }}>
                <Avatar sx={{ width: 28, height: 28, mr: 1, bgcolor: '#6C63FF' }}>
                  <SmartToy sx={{ fontSize: 16 }} />
                </Avatar>
                <Box sx={{ px: 1.5, py: 1, borderRadius: '12px', bgcolor: 'rgba(255,255,255,0.06)' }}>
                  <Typography variant="body2" fontSize={13} sx={{ color: '#9CA3AF' }}>
                    Đang suy nghĩ...
                  </Typography>
                </Box>
              </Stack>
            )}
            <div ref={endRef} />
          </Box>

          {/* Quick Actions (show when few messages) */}
          {messages.length <= 2 && (
            <Stack direction="row" flexWrap="wrap" gap={0.5} px={2} pb={1}>
              {QUICK_ACTIONS.map((qa, i) => (
                <Chip key={i} label={qa.label} size="small"
                  onClick={() => sendMessage(qa.msg)}
                  sx={{ fontSize: '0.7rem', bgcolor: 'rgba(108,99,255,0.1)', color: '#A5B4FC',
                    border: '1px solid rgba(108,99,255,0.2)', cursor: 'pointer',
                    '&:hover': { bgcolor: 'rgba(108,99,255,0.2)' } }} />
              ))}
            </Stack>
          )}

          {/* Input */}
          <Stack direction="row" spacing={1} sx={{ p: 1.5, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <TextField
              fullWidth size="small" placeholder="Nhập tin nhắn..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage(input))}
              disabled={loading}
              sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.05)', borderRadius: '10px', fontSize: 13 } }}
            />
            <IconButton onClick={() => sendMessage(input)} disabled={loading || !input.trim()}
              sx={{ bgcolor: 'rgba(108,99,255,0.2)', color: '#6C63FF', '&:hover': { bgcolor: 'rgba(108,99,255,0.3)' } }}>
              <Send fontSize="small" />
            </IconButton>
          </Stack>
        </Paper>
      </Fade>
    </>
  );
};

export default ChatbotWidget;
