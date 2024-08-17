const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const User = mongoose.model('User', {
  name: String,
  socketId: String,
  online: Boolean,
});

const Room = mongoose.model('Room', {
  name: String,
  users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
});

const Message = mongoose.model('Message', {
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  content: String,
  timestamp: Date,
  read: Boolean,
});

io.on('connection', (socket) => {
  console.log('New client connected');

  socket.on('join', async ({ name, room }) => {
    let user = await User.findOne({ name });
    if (!user) {
      user = new User({ name, socketId: socket.id, online: true });
      await user.save();
    } else {
      user.socketId = socket.id;
      user.online = true;
      await user.save();
    }

    let roomDoc = await Room.findOne({ name: room });
    if (!roomDoc) {
      roomDoc = new Room({ name: room, users: [user._id] });
      await roomDoc.save();
    } else if (!roomDoc.users.includes(user._id)) {
      roomDoc.users.push(user._id);
      await roomDoc.save();
    }

    socket.join(room);
    
    // Emit a 'userJoined' event to all users in the room except the one joining
    socket.to(room).emit('userJoined', { name: user.name, room });
    
    // Send past messages to the joining user
    const pastMessages = await Message.find({ room: roomDoc._id })
      .sort({ timestamp: -1 })
      .limit(50)
      .populate('user', 'name');
    socket.emit('pastMessages', pastMessages.reverse());
  });

  socket.on('sendMessage', async ({ room, message }) => {
    const user = await User.findOne({ socketId: socket.id });
    const roomDoc = await Room.findOne({ name: room });
    
    const newMessage = new Message({
      room: roomDoc._id,
      user: user._id,
      content: message,
      timestamp: new Date(),
      read: false,
    });
    await newMessage.save();

    io.to(room).emit('message', { user: user.name, message, timestamp: newMessage.timestamp });
  });

  socket.on('typing', async ({ room }) => {
    const user = await User.findOne({ socketId: socket.id });
    socket.to(room).emit('typing', { name: user.name });
  });

  socket.on('stopTyping', ({ room }) => {
    socket.to(room).emit('stopTyping');
  });

  socket.on('disconnect', async () => {
    const user = await User.findOne({ socketId: socket.id });
    if (user) {
      user.online = false;
      await user.save();
      const rooms = await Room.find({ users: user._id });
      rooms.forEach(room => {
        io.to(room.name).emit('userLeft', { user: user.name, room: room.name });
      });
    }
    console.log('Client disconnected');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
