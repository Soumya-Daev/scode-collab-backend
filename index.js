const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const PORT = process.env.PORT;
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        // origin: "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
    },
});

let USERS = {};

app.get('/', (req, res) => {
    res.send(`<h1>Socket is up and running on ${PORT || 8000}</h1>`)
});

const getUsersInRoom = (roomId) => {
    // return Object.values(USERS).filter(user => user.roomId === roomId);
    return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
        (id) => {
            return {
                socketId: id,
                userName: USERS[id].userName,
            }
        }
    );
}

io.on('connection', (socket) => {
    console.log('a user connected', socket.id);

    socket.on('join', (data) => {
        // console.log('joined :', data);
        USERS[socket.id] = { userName: data.userName, roomId: data.roomId };
        socket.join(data.roomId);

        let clients = getUsersInRoom(data.roomId);
        // console.log('clients :', clients);
        // socket.to(data.roomId).emit('user-connected', data.userName);
        clients.forEach((client) => {
            io.to(client.socketId).emit('user-connected', {
                clients,
                socketId: socket.id,
                userName: data.userName,
            });
        });
    });

    socket.on('code-sync', (data) => {
        // console.log('code-sync :', data);
        io.to(data.socketId).emit('code-change', data.code);
    }); 

    socket.on('code-change', (data) => {
        // console.log('code-change :', data);
        socket.to(data.roomId).emit('code-change', data.code);
    });


    socket.on('language-change', (data) => {
        // console.log('language-change :', data);
        let clients = getUsersInRoom(data.roomId);
        clients.forEach((client) => {
            io.to(client.socketId).emit('change-language', {
                language: data.language,
                userName: data.userName,
                socketId: socket.id,
            });
        });
    });

    socket.on('leave-room', () => {
        io.sockets.adapter.rooms.get(USERS[socket.id]?.roomId)?.delete(socket.id);
        socket.to(USERS[socket.id]?.roomId).emit('user-disconnected', {
            userName: USERS[socket.id]?.userName,
            clients: getUsersInRoom(USERS[socket.id]?.roomId),
        });
        USERS[socket.id] = null;
        socket.leave();
    });

    socket.on('disconnect', () => {
        console.log('user disconnected', socket.id);
        io.sockets.adapter.rooms.get(USERS[socket.id]?.roomId)?.delete(socket.id);
        socket.to(USERS[socket.id]?.roomId).emit('user-disconnected', {
            userName: USERS[socket.id]?.userName,
            clients: getUsersInRoom(USERS[socket.id]?.roomId),
        });
        USERS[socket.id] = null;
        socket.leave();
    });
});

server.listen(PORT || 8000, () => {
    console.log(`Server is listening on port ${PORT || 8000}`);
    console.log(`http://localhost:${PORT || 8000}`);
});