# Welcome to React Router!

A minimal template for experimenting with React Router v7.

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/remix-run/react-router-templates/tree/main/minimal)

> ![NOTE]
> This template should not be used for production apps and is intended more for experimentation and demo applications. Please see the [default](https://github.com/remix-run/react-router-templates/tree/main/default) template for a more full-featured template.

## Getting Started

### Installation

Install the dependencies:

```bash
npm install
```

### Development

Start the development server with HMR:

```bash
npm run dev
```

Your application will be available at `http://localhost:5173`.

---

Built with ❤️ using React Router.

## Ticketing Flow

- Book tickets in `Dashboard` by selecting a match and quantity.
- Confirm payment via the "Make purchase" button. On confirmation:
	- The booking is marked `CONFIRMED`.
	- A `payment` record is created with `COMPLETED` status.
	- Individual `tickets` are issued for the booking (one per quantity).
- Issued tickets appear under the booking and in the "Your Tickets" section,
	showing seat number, type, price, and match info.
