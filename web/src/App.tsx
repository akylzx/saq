import { Nav } from "./components/Nav";
import { Footer } from "./components/Footer";
import { Hero } from "./sections/Hero";
import { Features } from "./sections/Features";
import { HowItWorks } from "./sections/HowItWorks";
import { Benefits } from "./sections/Benefits";
import { Demo } from "./sections/Demo";
import { Limitations } from "./sections/Limitations";
import { FinalCTA } from "./sections/FinalCTA";

export default function App() {
  return (
    <>
      <a className="skip-link" href="#try">
        Skip to the detector
      </a>
      <Nav />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <Benefits />
        <Demo />
        <Limitations />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
