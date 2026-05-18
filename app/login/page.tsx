import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-center text-xl font-semibold text-neutral-900">
          Weight Trend
        </h1>
        <p className="mt-1 text-center text-sm text-neutral-500">
          Sign in with your username and password
        </p>
        <LoginForm />
      </div>
    </main>
  );
}
