const express = require('express');
const cors = require('cors');
const Path = require('path');
const app = express();
const jwt = require('jsonwebtoken');

const matchesRoutes = require('./routes/matches');
const mapsRoutes = require('./routes/maps');
const leaderboardRoutes = require('./routes/leaderboard');
const tokenRoutes = require('./routes/token');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SUPER_SECRET_ADMIN = process.env.SUPER_SECRET_ADMIN || 'default_admin_token_private_key';

// Middleware per gestire i dati JSON e form-urlencoded
app.use(express.json());
// Middleware per chiamate cors
app.use(cors());

app.use('/', express.static( Path.join(__dirname, '..', 'packages', '\@unitn-asa', 'deliveroo-js-webapp', 'home') ));
app.use('/game', express.static( Path.join(__dirname, '..', 'packages', '\@unitn-asa', 'deliveroo-js-webapp','dist/game') ));

app.use('/api/matchs', matchesRoutes);
app.use('/api/maps', mapsRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/token', tokenRoutes);

app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (username === 'admin' && password === ADMIN_PASSWORD) {
        console.log("LOGIN ADMIN")
        const token = generateTokenAdmin();
        res.json({ success: true, token: token});
    } else {
        res.status(401).json({ success: false, message: 'Credenzialias not valid' });
    }
});

function generateTokenAdmin(){

    token = jwt.sign({user:'admin', password:'god1234'}, SUPER_SECRET_ADMIN );

    console.log( 'Generate new toke: ', token.slice(-30));
    return token

}


module.exports = app;





/**
 * Serve front-end static files
 */
// app.use('/', express.static('packages/\@unitn-asa/vite-project/dist/'));
// app.use('/', express.static(Path.join(__dirname, '..', 'packages', '\@unitn-asa', 'vite-project', 'dist')));
// app.use('/', express.static( Path.join(__dirname, '..', 'node_modules', '\@unitn-asa', 'deliveroo-js-webapp','home') ));
// app.use('/', express.static('static'));
// app.use("/", express.static(Path.join(__dirname, '..', 'static')));

// /**
//  * Agent id
//  */ls 
// app.use('/:id', (req, res) => {
//     // now use socket.io in your routes file
//     var io = req.app.get('socketio');
//     io.emit('hi!');
// } );