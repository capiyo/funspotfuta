export function PhasePlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/5">
        <span className="text-2xl">🚧</span>
      </div>
      <h1 className="mb-2 text-lg font-bold text-white">{title}</h1>
      <p className="text-sm text-gray-400">{description}</p>
    </div>
  );
}
