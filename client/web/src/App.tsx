import { useState } from 'react'
import { trpc } from './trpc'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import './App.css'

function App() {
  const [name, setName] = useState('World')
  const healthQuery = trpc.health.useQuery()
  const echoQuery = trpc.echo.useQuery(name)
  const [count, setCount] = useState(0)

  return (
    <>
      <section id="center">
        <div className="hero">
          <img src={heroImg} className="base" width="170" height="179" alt="" />
          <img src={reactLogo} className="framework" alt="React logo" />
          <img src={viteLogo} className="vite" alt="Vite logo" />
        </div>
        <div>
          <h1>tRPC + React + Express</h1>
          <p>{healthQuery.data ? `Service: ${healthQuery.data.service}` : 'Checking server...'}</p>
          <p>{echoQuery.data?.message}</p>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-label="Name"
          />
          <button onClick={() => setCount((current) => current + 1)} className="counter">
            Count is {count}
          </button>
        </div>
      </section>
    </>
  )
}

export default App
