// *****************************************************
// <!-- Section 1 : Import Dependencies -->
// *****************************************************

const express = require('express'); // To build an application server or API
const app = express();
const handlebars = require('express-handlebars');
const Handlebars = require('handlebars');
const path = require('path');
const pgp = require('pg-promise')(); // To connect to the Postgres DB from the node server
const bodyParser = require('body-parser');
const session = require('express-session'); // To set the session object. To store or access session data, use the `req.session`, which is (generally) serialized as JSON by the store.
const bcrypt = require('bcrypt'); //  To hash passwords
const axios = require('axios'); // To make HTTP requests from our server. We'll learn more about it in Part C.

// *****************************************************
// <!-- Section 2 : Connect to DB -->
// *****************************************************

// create `ExpressHandlebars` instance and configure the layouts and partials dir.
const hbs = handlebars.create({
  extname: 'hbs',
  layoutsDir: __dirname + '/views/layouts',
  partialsDir: __dirname + '/views/partials',
});

// database configuration
const dbConfig = {
  host: 'db', // the database server
  port: 5432, // the database port
  database: process.env.POSTGRES_DB, // the database name
  user: process.env.POSTGRES_USER, // the user account to connect with
  password: process.env.POSTGRES_PASSWORD, // the password of the user account
};

const db = pgp(dbConfig);

// test your database
db.connect()
  .then(obj => {
    console.log('Database connection successful'); // you can view this message in the docker compose logs
    obj.done(); // success, release the connection;
  })
  .catch(error => {
    console.log('ERROR:', error.message || error);
  });

// *****************************************************
// <!-- Section 3 : App Settings -->
// *****************************************************

// Register `hbs` as our view engine using its bound `engine()` function.
app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.json()); // specify the usage of JSON for parsing request body.

// initialize session variables
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    saveUninitialized: false,
    resave: false,
  })
);

app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

// *****************************************************
// <!-- Section 4 : API Routes -->
// *****************************************************

// TODO - Include your API routes here
app.get('/', (req, res) => {
  res.redirect('/login');
 });
 app.get('/login', (req, res) => {
  res.render('pages/login');
 });
 app.get('/register', (req, res) => {
  res.render('pages/register');
 });


 app.post('/register', async (req, res) => {
  try {
    const hash = await bcrypt.hash(req.body.password, 10);
    // Insert username and hashed password into the 'users' table
    await db.none('INSERT INTO users (username, password) VALUES ($1, $2)', [req.body.username, hash]);
    res.redirect('/login');
  } catch (error) {
    console.error('Error during registration:', error);
    res.redirect('/register');
  }
});

 app.post('/login', async (req, res) => {
  try {
    // Find the user in the database
    const user = await db.oneOrNone('SELECT * FROM users WHERE username = $1', req.body.username);

    // Check if user exists and password matches
    if (user && await bcrypt.compare(req.body.password, user.password)) {
      // Save user details in session
      req.session.user = user;
      req.session.save();
      // Redirect to discover page after successful login
      return res.redirect('/discover');
    } else {
      // If user is not found or password is incorrect, send error message
      return res.render('pages/login', { message: 'Incorrect username or password.' });
    }
  } catch (error) {
    console.error('Error during login:', error);
    // If an error occurs, redirect back to login page with a generic error message
    return res.render('pages/login', { message: 'An error occurred. Please try again.' });
  }
});
const API_KEY = 'tUkvUniNQuf58PNcf3d8z5VrEoWkSBC4';
app.get('/discover', async (req, res) => {
  const isAuthenticated = req.session.isAuthenticated;
  try {
    const response = await axios({
      url: 'https://app.ticketmaster.com/discovery/v2/events.json',
      method: 'GET',
      params: {
        size: 10, // Number of events to fetch
        keyword: 'music', // Keyword to search for events
        apikey: API_KEY, // Your Ticketmaster API key
      },
    });
    

    const results = response.data._embedded ? response.data._embedded.events : [];
    res.render('pages/discover', { results });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.render('pages/discover', { results: [], error: 'Failed to fetch events' });
  }
});

app.get('/logout', (req, res) => {
  // Destroy the session
  req.session.destroy(err => {
      if (err) {
          console.error('Error destroying session:', err);
          // Render the logout page with an error message
          res.render('pages/logout', { message: 'Logout failed. Please try again.' });
      } else {
          // Render the logout page with a success message
          res.render('pages/logout', { message: 'Logged out successfully.' });
      }
  });
});



 
 

// *****************************************************
// <!-- Section 5 : Start Server-->
// *****************************************************
// starting the server and keeping the connection open to listen for more requests
app.listen(3000);
console.log('Server is listening on port 3000');