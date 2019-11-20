'use strict';

// load modules
const express = require('express');
console.log('@@@GIL hi!');
const morgan = require('morgan');
const { models, Course, User } = require('./db');
// const Course = require('./db/models/course').Course;
const bcryptjs = require('bcryptjs');
const auth = require('basic-auth');
const { check, validationResult } = require('express-validator');

// variable to enable global error logging
const enableGlobalErrorLogging =
  process.env.ENABLE_GLOBAL_ERROR_LOGGING === 'true';

//Async Handles to retreive data async
function asyncHandler(cb) {
  return async (req, res, next) => {
    try {
      await cb(req, res, next);
    } catch (err) {
      next(err);
    }
  };
}
//Authentication of user

const authenicateUser = asyncHandler(async (req, res, next) => {
  let message = null;

  const credentials = auth(req);

  if (credentials) {
    const user = await models.User.findOne({
      where: {
        emailAddress: credentials.name
      }
    });

    if (user) {
      const authenticated = bcryptjs.compareSync(
        credentials.pass,
        user.password
      );

      if (authenticated) {
        req.currentUser = user;
      } else {
        message = `Authentication failure for email: ${user.emailAddress}`;
      }
    } else {
      message = `Authentication found for email ${credentials.emailAddress}`;
    }
  } else {
    message = `Auth header not found`;
  }
  if (message) {
    console.warn(message);
    res.status(401).json({ message: `Access Denied` });
  } else {
    next();
  }
});

//user validation
const userValidation = [
  check('firstName')
    .exists({ checkNull: true, checkFalsy: true })
    .withMessage('Please provide a value for "first name"'),
  check('lastName')
    .exists({ checkNull: true, checkFalsy: true })
    .withMessage('Please provide a value for "last name"'),
  check('emailAddress')
    .exists({ checkNull: true, checkFalsy: true })
    .withMessage('Please provide a value for "email"')
    .isEmail()
    .withMessage('Plase provie a valid email address for "email"'),
  check('password')
    .exists({ checkNull: true, checkFalsy: true })
    .withMessage('Plase  provide a value for "passowrd')
  // .custom(value => {
  //   return models.User.findUserByEmail(value).then(user => {
  //     if (user) {
  //       return Promise.reject('E-mail already in use');
  //     }
  //   })
  // }),
];
// create the Express app
const app = express();
// using middleware for reading json
app.use(express.json());
// setup morgan which gives us http request logging
app.use(morgan('dev'));

// TODO setup your api routes here

//USER ROUTES
app.get('/api/users', authenicateUser, (req, res) => {
  const user = req.currentUser;
  res.status(200).json({
    firstName: user.firstName,
    lastName: user.lastName,
    emailAddress: user.emailAddress
  });
});
//CREATE NEW USER WITH VALIDATION
app.post('/api/users', userValidation, (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => error.msg);
    res.status(400).json({ errors: errorMessages });
  } else {
    //Hashing the new user password
    const user = req.body;
    user.password = bcryptjs.hashSync(user.password);
    models.User.create(user)
      .then(() => {
        res.location('/');
        res.status(201).end();
      })
      .catch(err => {
        throw err;
      });
  }
});

//COURSES ROUTES
app.get(
  '/api/courses',
  asyncHandler(async (req, res) => {
    const course = await models.Course.findAll();
    res.json({ course });
    // const courses = await models.Course.findAll({ order: [['title', 'ASC']] });

    // if (courses) {
    //   res.status(200).json(
    //     {
    //       message: 'courses',
    //     }
    //     // {
    //     // title: courses.title,
    //     // description: courses.description,
    //     // }
    //   )
    // } else {

    // }
  })
);

app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the REST API project!'
  });
});

// send 404 if no other route matched
app.use((req, res) => {
  res.status(404).json({
    message: 'Route Not Found'
  });
});

// setup a global error handler
app.use((err, req, res, next) => {
  if (enableGlobalErrorLogging) {
    console.error(`Global error handler: ${JSON.stringify(err.stack)}`);
  }

  res.status(err.status || 500).json({
    message: err.message,
    error: {}
  });
});

// set our port
app.set('port', process.env.PORT || 5000);

// start listening on our port
const server = app.listen(app.get('port'), () => {
  console.log(`Express server is listening on port ${server.address().port}`);
});
