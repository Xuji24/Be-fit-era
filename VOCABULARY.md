# Technical Vocabulary

## Next.js & React
- **App Router**: The new routing paradigm in Next.js 13+ that uses the App directory, supporting React Server Components and nested layouts.
- **Server Actions**: Asynchronous functions executed on the server, typically used in Next.js for form submissions and data mutations directly from client components.
- **Client Component**: A React component that is rendered on the client side, allowing the use of state (useState), effects (useEffect), and browser APIs. Indicated by "use client" at the top of the file.
- **Server Component**: The default component type in the Next.js App Router, rendered on the server side to reduce JavaScript bundle sizes and improve performance.

## Database & Backend (Supabase)
- **RLS (Row Level Security)**: A PostgreSQL feature used by Supabase to restrict data access based on user roles and policies, ensuring users only see their own data.
- **pg_cron**: A PostgreSQL extension that allows scheduling database queries directly inside the database, functioning like a standard Unix cron job. Useful for automating daily tasks (e.g., race status updates).
- **Migration**: A SQL script used to update the database schema in a version-controlled way.

## UI & Styling
- **Shadcn UI**: A collection of re-usable components built with Radix UI and Tailwind CSS that you can copy and paste into your apps instead of installing as external packages.
- **Tailwind CSS**: A utility-first CSS framework for rapidly building custom user interfaces without leaving your HTML/JSX.
- **Abstracted Component**: A UI element built by encapsulating complex logic, styling, and functionality into a single, reusable function or tag. E.g., instead of writing out <div className="flex...">...</div> a hundred times, you create a <Card> component to abstract that code away.

## Functionality
- **GPX (GPS Exchange Format)**: An XML schema designed as a common GPS data format for software applications. Used for describing waypoints, tracks, and routes (useful for route mapping).
- **Blob Storage / Storage Buckets**: Cloud-based storage for unstructured data, like images, track files (.gpx), and documents.

