import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-50 text-center">
      <h1 className="text-8xl font-bold text-gray-800">404</h1>
      <p className="mt-4 text-xl text-gray-500">Page not found</p>

      <Link
        to="/"
        className="mt-6 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
      >
        กลับหน้าแรก
      </Link>
    </div>
  );
}