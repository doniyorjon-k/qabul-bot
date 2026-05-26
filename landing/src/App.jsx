import Nav from './components/Nav'
import Hero from './components/Hero'
import Stats from './components/Stats'
import Problem from './components/Problem'
import HowItWorks from './components/HowItWorks'
import Features from './components/Features'
import Demo from './components/Demo'
import Reminders from './components/Reminders'
import Pricing from './components/Pricing'
import Faq from './components/Faq'
import Cta from './components/Cta'
import Footer from './components/Footer'

export default function App() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Stats />
        <Problem />
        <HowItWorks />
        <Features />
        <Demo />
        <Reminders />
        <Pricing />
        <Faq />
        <Cta />
      </main>
      <Footer />
    </>
  )
}
