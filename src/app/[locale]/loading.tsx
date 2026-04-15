export default function Loading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <div className="relative w-16 h-16 mx-auto mb-4">
          <div className="absolute inset-0 rounded-full border-4 border-blue-100" />
          <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center text-xl">🏡</div>
        </div>
        <p className="text-gray-400 text-sm">載入中，請稍候…</p>
      </div>
    </div>
  );
}
