const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Productive Space Backend API',
      version: '1.0.0',
      description: 'API documentation for Productive Space Backend - A comprehensive booking and package management system',
      contact: {
        name: 'API Support',
        email: 'support@productivespace.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production' 
          ? 'https://your-production-domain.com' 
          : `http://localhost:${process.env.PORT || 3000}`,
        description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'User unique identifier'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address'
            },
            firstName: {
              type: 'string',
              description: 'User first name'
            },
            lastName: {
              type: 'string',
              description: 'User last name'
            },
            memberType: {
              type: 'string',
              enum: ['STUDENT', 'REGULAR'],
              description: 'Type of membership'
            },
            contactNumber: {
              type: 'string',
              description: 'User contact number'
            },
            studentVerificationStatus: {
              type: 'string',
              enum: ['PENDING', 'APPROVED', 'REJECTED'],
              description: 'Student verification status'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Account creation timestamp'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp'
            }
          }
        },
        Booking: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Booking unique identifier'
            },
            userId: {
              type: 'string',
              description: 'User who made the booking'
            },
            date: {
              type: 'string',
              format: 'date',
              description: 'Booking date'
            },
            startTime: {
              type: 'string',
              format: 'time',
              description: 'Booking start time'
            },
            endTime: {
              type: 'string',
              format: 'time',
              description: 'Booking end time'
            },
            seatNumber: {
              type: 'string',
              description: 'Assigned seat number'
            },
            status: {
              type: 'string',
              enum: ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'],
              description: 'Booking status'
            },
            totalAmount: {
              type: 'number',
              format: 'float',
              description: 'Total booking amount'
            },
            paymentStatus: {
              type: 'string',
              enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'],
              description: 'Payment status'
            }
          }
        },
        Package: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Package unique identifier'
            },
            name: {
              type: 'string',
              description: 'Package name'
            },
            description: {
              type: 'string',
              description: 'Package description'
            },
            price: {
              type: 'number',
              format: 'float',
              description: 'Package price'
            },
            duration: {
              type: 'integer',
              description: 'Package duration in days'
            },
            passes: {
              type: 'integer',
              description: 'Number of passes included'
            },
            isActive: {
              type: 'boolean',
              description: 'Whether package is active'
            }
          }
        },
        Payment: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Payment unique identifier'
            },
            amount: {
              type: 'number',
              format: 'float',
              description: 'Payment amount'
            },
            currency: {
              type: 'string',
              default: 'SGD',
              description: 'Payment currency'
            },
            status: {
              type: 'string',
              enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'],
              description: 'Payment status'
            },
            paymentMethod: {
              type: 'string',
              description: 'Payment method used'
            },
            referenceId: {
              type: 'string',
              description: 'Payment reference ID'
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message'
            },
            details: {
              type: 'string',
              description: 'Detailed error information'
            }
          }
        },
        Success: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Success status'
            },
            message: {
              type: 'string',
              description: 'Success message'
            },
            data: {
              type: 'object',
              description: 'Response data'
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and profile management'
      },
      {
        name: 'Bookings',
        description: 'Booking management operations'
      },
      {
        name: 'Packages',
        description: 'Package management and purchases'
      },
      {
        name: 'Payments',
        description: 'Payment processing and webhooks'
      },
      {
        name: 'Student Verification',
        description: 'Student verification system'
      },
      {
        name: 'Promo Codes',
        description: 'Promotional code management'
      },
      {
        name: 'Admin',
        description: 'Administrative operations'
      }
    ]
  },
  apis: [
    './app.js',
    './routes/*.js',
    './controllers/*.js'
  ]
};

const specs = swaggerJsdoc(options);

module.exports = {
  swaggerUi,
  specs
};

