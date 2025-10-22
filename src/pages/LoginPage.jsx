import LoginForm from "@/components/login-form";

export default function LoginPage() {
  return (
    <div
      className="
        min-h-svh flex flex-col items-center justify-center p-6 md:p-10
        bg-gradient-to-b from-green-600 to-green-100/40
        dark:from-green-900/60 dark:to-green-800/30
      "
    >
      <div className="w-full max-w-sm md:max-w-3xl">
        <LoginForm />
      </div>
    </div>
  );
}
