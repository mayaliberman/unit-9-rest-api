'use strict';

// load modules
const express = require('express');
const morgan = require('morgan');
const { sequelize, Sequelize, models } = require('./db');
const { User, Course } = models; 
const database = require('./seed/database');
const bcryptjs = require('bcryptjs');
const auth = require('basic-auth');
const { check, validationResult } = require('express-validator');

// variable to enable global error logging
const enableGlobalErrorLogging = process.env.ENABLE_GLOBAL_ERROR_LOGGING === 'true';


//Async Handles to retreive data async
function asyncHandler(cb) {
  return async (req, res, next) => {
    try {
      await cb(req, res, next);
    } catch (err) {
      next(err);
    }
  }
}
//Authentication of user 

const authenicateUser = asyncHandler ( async (req, res, next) => {
  let message = null;

  const credentials = auth(req);
    
  if (credentials) {
    const user = await User.findOne({
      where: {
        emailAddress: credentials.name
      }
    });
    
    if (user) {
      const authenticated = bcryptjs
        .compareSync(credentials.pass, user.password);
      
      if (authenticated) {
       
        req.currentUser = user;

      } else {
        message = `Authentication failure for email: ${user.emailAddress}`
      }
    } else {
      message = `Authentication found for email ${credentials.emailAddress}`
    }
  } else {
    message = `Auth header not found`
  }
  if (message) {
    console.warn(message);
    res.status(401).json({ message: `Access Denied` })
  } else {
    next();
  }
});

// create the Express app
const app = express();

// setup morgan which gives us http request logging
app.use(morgan('dev'));

// TODO setup your api routes here

//USER ROUTES
app.get('/api/users', authenicateUser, (req, res) => {
  const user = req.currentUser;
  console.log('/ ', user)
  res.status(200).json({
    name: user.firstName,
    email: user.emailAddress
  });

});

app.post('/users', [
  check('firstName')
    .exists({ checkNull: true, checkFalsy: true })
    .withMessage('Please provide a valude for "name"'),
  check('lastName')
    .exists({ checkNull: true, checkFalsy: true })
    .withMessage('Please provide a value for "userame"'),
  check('emailAddress')
    .exists({ checkNull: true, checkFalsy: true })
    .withMessage('Please provide a value for "emailAddress"'),

  check('password')
    .exists({ checkNull: true, checkFalsy: true })
    .withMessage('Please provide a value for "password"'),

], (req, res) => {
  const errors = validationResult(req);
  // Get the user from the request body

  if (!errors.isEmpty()) {
    const errorMessage = errors.array().map(error => error.msg);
    return res.status(400).json({ errors: errorMessage });
  }
  const user = req.body;
  user.password = bcryptjs.hashSync(user.password);
  //Add the user to the 'users' array.
  users.push(user);

  res.status(201).end();
})
// router.post('/quotes', asyncHandler(async (req, res) => {
//   if (req.body.author && req.body.quote) {
//     const quote = await records.createQuote({
//       quote: req.body.quote,
//       author: req.body.author
//     });
//     res.status(201).json(quote);
//   } else {
//     res.status(400).json({ message: "Quote and author required." });
//   }
// }));
// app.post('/api/users', asyncHandler(async (req, res) => {
//   User.create(req.body)
//     .then(() => {
//       res.redirect('/');
//     })
//     .catch((err) => {
//       res.status(500)

//     })
//   // res.sendRedirect('/');
//   // res.redirect('/');
//   res.status(201).end();
// }))
// // setup a friendly greeting for the root route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the REST API project!',
  });
});

// send 404 if no other route matched
app.use((req, res) => {
  res.status(404).json({
    message: 'Route Not Found',
  });
});

// setup a global error handler
app.use((err, req, res, next) => {
  if (enableGlobalErrorLogging) {
    console.error(`Global error handler: ${JSON.stringify(err.stack)}`);
  }

  res.status(err.status || 500).json({
    message: err.message,
    error: {},
  });
});

// set our port
app.set('port', process.env.PORT || 5000);

// start listening on our port
const server = app.listen(app.get('port'), () => {
  console.log(`Express server is listening on port ${server.address().port}`);
});
