import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-totalobserver-dark flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-totalobserver-blue mb-4">
          TotalObserver Demo
        </h1>
        <p className="text-white mb-6">
          React + Vite + Tailwind setup complete
        </p>
        <button
          onClick={() => setCount((count) => count + 1)}
          className="bg-totalobserver-blue text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors"
        >
          Count is {count}
        </button>
      </div>
    </div>
  )
}

export default App
