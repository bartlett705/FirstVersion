const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const passport = require('passport');
const PassportGithub = require('passport-github2').Strategy;
const Sequelize = require('sequelize');
const session = require('express-session');
const Server = require('socket.io');
const io = new Server();
const path = require('path');
const {postMessage, getMessage} = require('./controllers/messageController.js');
const {getRooms, createRoom} = require('./controllers/roomController.js');
const {isLoggedIn} = require('./controllers/sessionController.js');
const {Room, User, Msg} = require('../Schemas/Tables.js');
const {GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET} = require('./config.secret');
// Create our app
const app = express();
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({extended: true})); // support encoded bodies
app.use(express.static(path.join(__dirname, '../public')));
app.use(passport.initialize());


const passportObject = {
        clientID: GITHUB_CLIENT_ID,
        clientSecret: GITHUB_CLIENT_SECRET,
        callbackURL: "http://localhost:3000/auth/github_oauth/callback"
};
//Passport session setup - we need to store the user ID when serializing, and find the user by ID when deserializing.
passport.serializeUser( (user, done) => done(null, user));

passport.deserializeUser((obj, done) => done(null, obj));

//utilizing the GitHubStrategy within Passport. the Verify function will invoke a callback with a user object.

passport.use(
  new PassportGithub(passportObject,(accessToken, refreshToken, profile, done) => {
    User.findOrCreate( {where: {displayname: profile.id}})
    .then( (user) => done(null, user))
    .catch( err => done(err))
  }));

app.get('/login', (req,res) => res.sendFile(path.join(__dirname, '../public/login.html')));

app.get('/auth/github_oauth/callback', passport
  .authenticate('github', { failureRedirect: '/login'}),
  (req, res) => {
    const userInfo = req.user[0]['dataValues'];
    const id = userInfo._id;
    const displayname = userInfo.displayname;
    res.cookie('user_id', id);
    res.cookie('displayname', displayname)
  	res.cookie('session', req.session);
  	res.redirect('/');

	});

//with successful authentication user is redirected to homepage. Otherwise, redirected back to login page.
app.post('/login', (req,res,next) => next(), passport
   .authenticate('github', {
                successRedirect: '/',
							  failureRedirect: '/login',
						    failureFlash: true }));

//Express route for setting cookies. Will first got to cookieController middleware.
// app.get('/', cookieController.setCookie, (req, res) => res.send('set cookie'));


//Express route to get list of rooms in a nearby area
//responds with list of rooms
app.get('/roomlist', isLoggedIn, getRooms);

//Express route for saving message from specfic room:id
app.post('/rooms/:roomid', isLoggedIn, postMessage , (req,res) => res.end()) //added af for end()

//Express route for returing list of messages for specific :roomid
app.get('/rooms/:roomid', isLoggedIn, getMessage, (req, res) => res.end());

app.post('/createroom', isLoggedIn, createRoom, (req, res) => res.end());

//testing socket io connection
io.on('connection', (socket) => {
    socket.emit('test', {hello: 'hello world'});
});

//listening on port 3000
app.listen(3000, () => console.log('Express server is up on port 3000'));
