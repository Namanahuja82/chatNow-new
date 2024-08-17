import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import io from 'socket.io-client';

const ENDPOINT = 'http://localhost:3000';

function ChatRoom() {
  const { room } = useParams();
  const location = useLocation();
  const { name } = location.state;
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [socket, setSocket] = useState(null);
  const [typing, setTyping] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const newSocket = io(ENDPOINT);
    setSocket(newSocket);

    newSocket.emit('join', { name, room });

    // Set up event listeners
    newSocket.on('pastMessages', (pastMessages) => {
      setMessages(pastMessages.map(msg => ({
        user: msg.user.name,
        message: msg.content,
        timestamp: new Date(msg.timestamp)
      })));
    });

    newSocket.on('message', (msg) => {
      setMessages((prevMessages) => [...prevMessages, msg]);
    });

    newSocket.on('userJoined', (data) => {
      setMessages((prevMessages) => [
        ...prevMessages,
        { user: 'System', message: `${data.name} has joined the room.`, timestamp: new Date() }
      ]);
    });

    newSocket.on('typing', (data) => setTyping(data.name));
    newSocket.on('stopTyping', () => setTyping(null));

    // Cleanup function
    return () => {
      newSocket.off('pastMessages');
      newSocket.off('message');
      newSocket.off('userJoined');
      newSocket.off('typing');
      newSocket.off('stopTyping');
      newSocket.close();
    };
  }, [name, room]); // Only re-run if name or room changes

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (message && socket) {
      socket.emit('sendMessage', { room, message });
      setMessage('');
    }
  };

  const handleTyping = (e) => {
    setMessage(e.target.value);
    if (socket) {
      socket.emit('typing', { room });
      setTimeout(() => socket.emit('stopTyping', { room }), 1000);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="bg-blue-500 text-white p-4">
        <h1 className="text-2xl">Room: {room}</h1>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((msg, index) => (
          <div key={index} className={`mb-2 ${msg.user === 'System' ? 'text-gray-500 italic' : ''}`}>
            <strong>{msg.user}:</strong> {msg.message}
          </div>
        ))}
        {typing && <div className="italic text-gray-500">{typing} is typing...</div>}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={sendMessage} className="bg-gray-200 p-4">
        <input
          type="text"
          value={message}
          onChange={handleTyping}
          className="w-full p-2 rounded"
          placeholder="Type a message..."
        />
      </form>
    </div>
  );
}

export default ChatRoom;