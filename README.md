# Let's Revise Platform

## Project Structure

\\\
letsrevise-new/
├── backend/           # Node.js/Express API server
│   ├── models/       # Database models
│   ├── routes/       # API routes
│   ├── controllers/  # Route controllers
│   ├── middleware/   # Custom middleware
│   ├── config/       # Configuration files
│   ├── utils/        # Utility functions
│   ├── server.js     # Main server file
│   └── package.json
├── frontend/          # React TypeScript application
│   ├── src/
│   │   ├── components/ # React components
│   │   ├── pages/     # Page components
│   │   ├── services/  # API services
│   │   ├── utils/     # Frontend utilities
│   │   └── types/     # TypeScript types
│   ├── public/
│   └── package.json
├── database/          # Database scripts & migrations
├── docs/             # Documentation
└── static-site/      # Existing static HTML site (copied from original)
\\\

## Development Setup

### Backend
1. Navigate to \ackend\ folder
2. Run \
pm install\
3. Create a \.env\ file (see \.env.example\)
4. Run \
ode server.js\

### Frontend
1. Navigate to \rontend\ folder
2. Run \
pm install\
3. Run \
pm start\

## Existing Static Site
The existing static HTML site is located in \static-site\ folder. This will be migrated gradually to the React application.
