export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F9F9F8] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <p className="text-center text-2xl font-bold text-gray-900 mb-6">가계부</p>
        {children}
      </div>
    </div>
  )
}
