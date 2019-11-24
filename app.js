'use strict';

// load modules
const express = require('express');
const morgan = require('morgan');
const { models } = require('./db');
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
//*****HELPER FUNCTIONS*****

//USER AUTHENTICATION
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

//USER VALIDATION
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
    .withMessage('Please provie a valid email address for "email"'),
  check('password')
    .exists({ checkNull: true, checkFalsy: true })
    .withMessage('Please  provide a value for "passowrd')
];

//COURSE VALIDATION
const courseValidation = [
  check('title')
    .exists({ checkNull: true, checkFalsy: true })
    .withMessage('Please provide a value for "title"'),
  check('description')
    .exists({ checkNull: true, checkFalsy: true })
    .withMessage('Please provide a value for "description"')
];

//EXPRESS HELPER FUNCTIONS

// create the Express app
const app = express();
// using middleware for reading json
app.use(express.json());
// setup morgan which gives us http request logging
app.use(morgan('dev'));

////////API ROUTES/////////

//*****USER ROUTES*******

//GETING A SPECIFIC USER WITH AUTHENTICATION
app.get('/api/users', authenicateUser, (req, res) => {
  const user = req.currentUser;
  res.status(200).json({
    firstName: user.firstName,
    lastName: user.lastName,
    emailAddress: user.emailAddress
  });
});

//CREATE NEW USER WITH VALIDATION
app.post(
  '/api/users',
  userValidation,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(error => error.msg);
      res.status(400).json({ errors: errorMessages });
    } else {
      //Hashing the new user password
      const user = req.body;
      user.password = bcryptjs.hashSync(user.password);
      const newUser = await models.User.create(user);
      if (newUser) {
        res.location('/');
        res.status(201).end();
      } else {
        throw err;
      }
    }
  })
);

//*****COURSES ROUTES*****

//LIST OF ALL COURSES IN DATABASE
app.get(
  '/api/courses',
  asyncHandler(async (req, res) => {
    const course = await models.Course.findAll({
      attributes: { exclude: ['createdAt', 'updatedAt'] },
      include: [
        {
          model: models.User,
          attributes: ['firstName', 'lastName', 'emailAddress']
        }
      ]
    });
    if (course) {
      res.json({ course });
      res.status(200);
    } else {
      res.status(500).json({ message: err });
    }
  })
);

//GET A COURSE BY QUERY
app.get(
  '/api/courses/:id',
  asyncHandler(async (req, res) => {
    const courseId = req.params.id;
    const course = await models.Course.findByPk(courseId, {
      attributes: { exclude: ['createdAt', 'updatedAt'] },
      include: [
        {
          model: models.User,
          attributes: ['firstName', 'lastName', 'emailAddress']
        }
      ]
    });
    if (course) {
      res.json({ course });
      res.status(200);
    } else {
      res.status(404).json({ message: 'page not found' });
    }
  })
);

//ADDING A NEW POST WITH AUTHENTICATION AND VALIDATION
app.post(
  '/api/courses',
  courseValidation,
  authenicateUser,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(error => error.msg);
      res.status(400).json({ errors: errorMessages });
    } else {
      const course = req.body;
      const newCourse = await models.Course.create(course);
      if (newCourse) {
        res.location(newCourse.id);
        return res.status(201).end();
      } else {
        res.status(400).json({ message: err });
      }
    }
  })
);

//UPDATING AN EXISING COURSE
app.put(
  '/api/courses/:id',
  authenicateUser, courseValidation,
  asyncHandler(async (req, res) => {
    const user = req.currentUser.id;
    const userId = req.body.userId;
    const title = req.body.title;
    const description = req.body.description;
    console.log('user', user, 'userId', userId);

    if (user === userId) {
      if (title && description) {
        const course = await models.Course.update(
          {
            title: req.body.title,
            description: req.body.description,
            materialsNeeded: req.body.materialsNeeded,
            userId: req.body.userId
          },
          { where: { id: req.params.id } }
        );
        if (course) {
          res.status(204).end();
        } else {
          res.status(400);
        }
      } else {
        res.status(400);
      }
    } else {
      res
        .status(403).end()
        
    }
  })
);

//DELETE AND EXISTING COURSE
app.delete(
  '/api/courses/:id',
  authenicateUser,
  asyncHandler(async (req, res) => {
    const deleteCourse = await models.Course.findOne({
      where: { id: req.params.id }
    });
    const user = req.currentUser.id;
    if (deleteCourse.userId === user) {
      const deleteConfirmation = await deleteCourse.destroy();
      if (deleteConfirmation) {
        res.location('/');
        res.status(204).end();
      } else {
        res.status(400).send();
      }
    } else {
      res.status(403).end();
    }
  })
);

//*****GENERAL ROUTEES*****
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
app.use((err, req, res) => {
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
