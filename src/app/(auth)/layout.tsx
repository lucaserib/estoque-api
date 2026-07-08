const AuthLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="auth-container rounded-xl border border-border bg-card p-8">
          {children}
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
