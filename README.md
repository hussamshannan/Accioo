# Accioo

A real-time social communication platform built with React and Node.js. Chat, call, share stories, and connect with friends — all in one place.

## Features

- **Real-time messaging** — instant chat powered by Socket.io
- **Voice & video calls** — peer-to-peer WebRTC calling
- **Stories** — share ephemeral photo/video stories with friends
- **Profile posts** — Instagram-style profile grid with photo posts
- **Friend system** — send/accept friend requests, manage contacts
- **Activity feed** — see likes, comments, and friend activity
- **Dark/Light theme** — toggle between themes with smooth transitions
- **Authentication** — secure sign-up/sign-in via Clerk

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, Vite, Tailwind CSS, SCSS, Radix UI, GSAP |
| Backend | Node.js, Express, Socket.io, Mongoose |
| Database | MongoDB |
| Auth | Clerk |
| Media | Cloudinary |
| 3D | Spline (login page) |

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB instance (local or Atlas)
- [Clerk](https://clerk.com) account
- [Cloudinary](https://cloudinary.com) account

### Installation

```bash
# Clone the repo
git clone https://github.com/hussamshannan/Accioo.git
cd Accioo

# Install client dependencies
cd client
npm install

# Install server dependencies
cd ../server
npm install
```

### Environment Variables

Copy the example files and fill in your credentials:

```bash
cp client/.env.example client/.env
cp server/.env.example server/.env
```

**Client** (`client/.env`):
```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_API_URL=http://localhost:3001
VITE_SOCKET_URL=http://localhost:3001
VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
```

**Server** (`server/.env`):
```
PORT=3001
MONGODB_URI=mongodb+srv://...
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### Running Locally

```bash
# Start the server (from /server)
npm run dev

# Start the client (from /client)
npm run dev
```

The client runs on `http://localhost:5173` and the server on `http://localhost:3001`.

## Project Structure

```
Accioo/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── contexts/       # React contexts (Auth, Socket, Theme, Chat, Call)
│   │   ├── pages/          # Route pages
│   │   ├── scss/           # SCSS stylesheets
│   │   └── utils/          # Constants and helpers
│   └── public/
├── server/                 # Express backend
│   ├── config/             # DB and CORS config
│   ├── middleware/          # Auth middleware
│   ├── models/             # Mongoose models
│   ├── routes/             # API routes
│   └── socket/             # Socket.io event handlers
└── netlify.toml            # Netlify deployment config
```

## Deployment

- **Frontend** — deployed on [Netlify](https://netlify.com) (auto-builds from `client/`)
- **Backend** — deployed on [Render](https://render.com) (runs from `server/`)

## License

MIT
