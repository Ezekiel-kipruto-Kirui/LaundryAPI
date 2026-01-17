import { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faBars, 
  faPhoneAlt, 
  faStar, 
  faEnvelope, 
  faMapMarkerAlt,
} from '@fortawesome/free-solid-svg-icons';
import { faFacebookF, faTwitter as faTwitterT, faInstagram as faInstagramI, faWhatsapp } from '@fortawesome/free-brands-svg-icons';
import {ROUTES} from "@/services/Routes"

// Placeholder images
const IMAGES = {
  background1: "./background1.jpg",
  washing: "./washing.jpg",
  ironing: "./ironing.jpg",
  folding: "./Folding.jpg",
  drycleaning: "./Drycleaning.png",
};

export default function LaundryLanding() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const currentYear = new Date().getFullYear();
  
  // Refs for animation
  const heroRef = useRef(null);
  const servicesRef = useRef(null);
  const aboutRef = useRef(null);
  const contactRef = useRef(null);

 

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  const closeMenu = () => setIsMenuOpen(false);

  // Scroll Animation Hook
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.1 });

    const refs = [heroRef, servicesRef, aboutRef, contactRef];
    refs.forEach(ref => {
      if (ref.current) observer.observe(ref.current);
    });

    return () => {
      refs.forEach(ref => {
        if (ref.current) observer.unobserve(ref.current);
      });
    };
  }, []);

  return (
    // FIX: Added 'no-scrollbar' class to hide scrollbars globally
    <div className="bg-white text-gray-800 overflow-x-hidden no-scrollbar" style={{ fontFamily: 'Poppins, sans-serif' }}>
      
      {/* Custom Styles + Animations */}
      <style>{`
        /* Google Fonts Import */
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');
        
        :root {
          --color-primary-blue: #007bff;
          --color-secondary-green: #28a745;
        }
        
        .btn-hover-animation { transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        .btn-hover-animation:hover { transform: translateY(-3px); box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2); }
        
        /* Animation Keyframes & Classes */
        .reveal-element {
          opacity: 1; /* Ensure visible initially */
          transform: translateY(30px);
          transition: all 0.8s ease-out;
        }
        
        .reveal-element.visible {
          opacity: 1;
          transform: translateY(0);
        }

        /* Staggered delays for children */
        .delay-100 { transition-delay: 100ms; }
        .delay-200 { transition-delay: 200ms; }
        .delay-300 { transition-delay: 300ms; }

        /* Card Hover */
        .service-card {
          transition: all 0.3s ease;
        }
        .service-card:hover {
          transform: translateY(-10px);
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        }

        .filter-blur-50 { filter: blur(98px); }
        
        /* FIX: CSS to hide scrollbars */
        .no-scrollbar::-webkit-scrollbar {
            display: none;
        }
        .no-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
        }
      `}</style>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 bg-blue-900 bg-opacity-95 backdrop-blur-md shadow-lg py-4 z-50 transition-all duration-300">
        <div className="container mx-auto px-4 flex justify-between items-center text-white">
          <a href="#home" className="text-2xl font-bold tracking-wide">Clean Page</a>
          
          {/* Desktop Menu */}
          <div className="hidden md:flex space-x-8 items-center">
            <a href="#home" className="text-white hover:text-blue-200 font-medium transition hover:scale-105 transform">Home</a>
            <a href="#services" className="text-white hover:text-blue-200 font-medium transition hover:scale-105 transform">Services</a>
            <a href="#about" className="text-white hover:text-blue-200 font-medium transition hover:scale-105 transform">About</a>
            <a href="#contact" className="text-white hover:text-blue-200 font-medium transition hover:scale-105 transform">Contact</a>
            <a href={ROUTES.login} className="px-5 py-2 border border-white rounded-full hover:bg-white hover:text-blue-900 transition font-semibold text-sm">Login</a>
          </div>

          {/* Mobile Menu Button */}
          <button 
            className="md:hidden text-white focus:outline-none" 
            onClick={toggleMenu}
            aria-label="Toggle Menu"
          >
            <FontAwesomeIcon icon={faBars} className="text-xl" />
          </button>
        </div>

        {/* Mobile Menu */}
        <div className={`${isMenuOpen ? 'block' : 'hidden'} md:hidden bg-blue-900 absolute top-16 left-0 right-0 z-40 p-4 shadow-xl border-t border-blue-800`}>
          <div className="flex flex-col space-y-4">
            <a href="#home" onClick={closeMenu} className="text-white hover:text-blue-200 font-medium text-lg">Home</a>
            <a href="#services" onClick={closeMenu} className="text-white hover:text-blue-200 font-medium text-lg">Services</a>
            <a href="#about" onClick={closeMenu} className="text-white hover:text-blue-200 font-medium text-lg">About</a>
            <a href="#contact" onClick={closeMenu} className="text-white hover:text-blue-200 font-medium text-lg">Contact</a>
            <a href="/login" onClick={closeMenu} className="text-white hover:text-blue-200 font-medium text-lg">Login</a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section 
        id="home" 
        ref={heroRef}
        className="relative h-screen w-full flex items-center justify-center pt-16 mt-4 md:mt-1 sm:mt-1 overflow-hidden"
        style={{
          backgroundImage: `url('${IMAGES.background1}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
         <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between relative  z-30">
          <div className="md:w-1/2 text-center md:text-left mb-12 md:mb-0">
            <h1 className="reveal-element text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6 drop-shadow-lg">
              Be Spotless. <br className="hidden md:block" />
              <span className="text-blue-100">Be Bright</span>
            </h1>

            <p className="reveal-element delay-100 text-lg sm:text-xl text-white mb-8 max-w-lg mx-auto md:mx-0 font-light leading-relaxed">
              Experience laundry like never before — fast, fresh, and flawlessly folded.
              We pick up, clean with care, and deliver comfort right to your door.
            </p>
            
            <div className="reveal-element delay-200 flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 justify-center md:justify-start">
              <a href="tel:+254705588354 " className="btn-hover-animation bg-blue-600 text-white px-8 py-4 rounded-full font-bold text-base flex items-center justify-center">
                <FontAwesomeIcon icon={faPhoneAlt} className="mr-3" /> Call Us
              </a>
              <a href="https://wa.me/+254705588354 " target="_blank" rel="noreferrer" className="btn-hover-animation bg-green-600 text-white px-8 py-4 rounded-full font-bold text-base flex items-center justify-center hover:bg-green-700">
                <FontAwesomeIcon icon={faWhatsapp} className="mr-3" /> WhatsApp Us
              </a>
            </div>

           
          </div>

          <div className="reveal-element md:w-1/2 flex justify-center md:justify-end">
            <div className="relative w-full max-w-xs sm:max-w-sm md:max-w-md transform transition-transform hover:scale-105 duration-500">
              <img src={IMAGES.washing} alt="Professional Laundry Service" className="w-full h-auto object-cover rounded-3xl shadow-2xl border-4 border-white/20" />
              <div className="absolute -bottom-6 -left-6 bg-white p-4 rounded-xl shadow-xl flex items-center space-x-3 reveal-element delay-100">
                <div className="bg-green-100 p-2 rounded-full">
                  <FontAwesomeIcon icon={faStar} className="text-green-600" />
                </div>
                <div>
                  <div className="font-bold text-xl text-gray-900">4.9/5</div>
                  <div className="text-sm text-gray-500">(850 Reviews)</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Dark Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-blue-900/90 to-blue-900/70 z-0"></div>

        {/* Decorative Blur Circles */}
        <div className="absolute bottom-[-80px] right-[-80px] w-[150px] h-[150px] md:w-[250px] md:h-[250px] rounded-full bg-white bg-opacity-8 filter-blur-50 z-0 animate-pulse"></div>
        <div className="absolute top-1/5 left-[7%] -translate-x-1/2 -translate-y-1/2 w-[150px] h-[150px] md:w-[250px] md:h-[250px] bg-white bg-opacity-6 filter-blur-50 z-0 animate-pulse"></div>
        <div className="absolute top-[20%] right-[15%] w-[200px] h-[200px] md:w-[350px] md:h-[350px] rounded-full bg-white bg-opacity-4 filter-blur-50 z-0 animate-pulse"></div>

        {/* Content Wrapper - Added overflow-y-auto for mobile safety */}
       
        
        {/* Scroll Down Indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce text-white z-20">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path></svg>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" ref={servicesRef} className="bg-gray-50 py-20 md:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16 reveal-element">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 relative inline-block">
              Our Services
              <span className="block h-1 w-20 bg-blue-600 mx-auto mt-2 rounded"></span>
            </h2>
            <p className="mt-4 text-gray-600 max-w-2xl mx-auto">Professional laundry solutions tailored to your needs.</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 md:gap-10">
            {/* Washing */}
            <div className="reveal-element delay-100 service-card bg-white rounded-2xl shadow-lg overflow-hidden flex flex-col sm:flex-row h-full">
              <div className="sm:w-2/5 h-48 sm:h-auto">
                <img className="w-full h-full object-cover" src={IMAGES.washing} alt="Washing service" />
              </div>
              <div className="sm:w-3/5 p-6 flex flex-col justify-center">
                <div className="text-sm font-bold tracking-wider text-blue-600 uppercase mb-2">Washing</div>
                <p className="text-gray-600 mb-4">
                  We offer high standard washing service. We handle customers with greater Professionalism.
                </p>
                <div className="text-xl font-bold text-gray-800">Affordable Rates</div>
              </div>
            </div>

            {/* Ironing */}
            <div className="reveal-element delay-200 service-card bg-white rounded-2xl shadow-lg overflow-hidden flex flex-col sm:flex-row h-full">
              <div className="sm:w-2/5 h-48 sm:h-auto">
                <img className="w-full h-full object-cover" src={IMAGES.ironing} alt="Ironing service" />
              </div>
              <div className="sm:w-3/5 p-6 flex flex-col justify-center">
                <div className="text-sm font-bold tracking-wider text-blue-600 uppercase mb-2">Ironing</div>
                <p className="text-gray-600 mb-4">
                  Crisp lines, wrinkle-free confidence — our expert ironing brings out the best in every fabric.
                </p>
                <div className="text-xl font-bold text-gray-800">Perfect Finish</div>
              </div>
            </div>

            {/* Folding */}
            <div className="reveal-element delay-100 service-card bg-white rounded-2xl shadow-lg overflow-hidden flex flex-col sm:flex-row h-full">
              <div className="sm:w-2/5 h-48 sm:h-auto">
                <img className="w-full h-full object-cover" src={IMAGES.folding} alt="Folding service" />
              </div>
              <div className="sm:w-3/5 p-6 flex flex-col justify-center">
                <div className="text-sm font-bold tracking-wider text-blue-600 uppercase mb-2">Folding</div>
                <p className="text-gray-600 mb-4">
                  From laundry basket to beautifully folded, we handle final touches that make life feel organized.
                </p>
                <div className="text-xl font-bold text-gray-800">Neat & Tidy</div>
              </div>
            </div>

            {/* Dry Cleaning */}
            <div className="reveal-element delay-200 service-card bg-white rounded-2xl shadow-lg overflow-hidden flex flex-col sm:flex-row h-full">
              <div className="sm:w-2/5 h-48 sm:h-auto">
                <img className="w-full h-full object-cover" src={IMAGES.drycleaning} alt="Dry cleaning service" />
              </div>
              <div className="sm:w-3/5 p-6 flex flex-col justify-center">
                <div className="text-sm font-bold tracking-wider text-blue-600 uppercase mb-2">Dry Cleaning</div>
                <p className="text-gray-600 mb-4">
                  Experience the elegance of precision dry cleaning we preserve the quality and color of your finest outfits.
                </p>
                <div className="text-xl font-bold text-gray-800">Expert Care</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" ref={aboutRef} className="py-20 md:py-24 bg-white relative overflow-hidden">
        {/* Decorative Circle */}
        <div className="absolute -left-20 top-20 w-64 h-64 bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-12 reveal-element">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 relative inline-block">
              About Clean Page Laundry
              <span className="block h-1 w-20 bg-green-500 mx-auto mt-2 rounded"></span>
            </h2>
          </div>
          <div className="max-w-4xl mx-auto reveal-element delay-100">
            <div className="bg-blue-50 p-8 md:p-12 rounded-3xl shadow-sm border border-blue-100">
              <p className="text-gray-700 text-lg md:text-xl leading-relaxed text-center">
                We are a modern laundry service dedicated to making your life easier through fast, reliable, and
                affordable washing, ironing, folding, and dry-cleaning solutions. Whether you're a busy professional,
                a family, or a business, we handle your laundry with care and deliver freshness right to your
                doorstep.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" ref={contactRef} className="bg-gray-900 text-white py-20 md:py-24">
        <div className="container mx-auto px-4 items-center">
          <div className="text-center mb-16 reveal-element">
            <h2 className="text-3xl md:text-4xl font-bold relative inline-block">
              Contact Us
              <span className="block h-1 w-20 bg-white mx-auto mt-2 rounded"></span>
            </h2>
          </div>
          <div className="flex flex-col lg:flex-row justify-around items-start gap-12">
            <div className="lg:w-1/3 reveal-element delay-100">
              <h3 className="text-2xl font-bold mb-6 text-blue-300">Contact details</h3>
              <div className="space-y-6">
                <div className="flex items-center group">
                  <div className="bg-blue-800 p-3 rounded-full mr-4 group-hover:bg-blue-700 transition">
                    <FontAwesomeIcon icon={faEnvelope} className="text-xl" />
                  </div>
                  <span className="text-lg">cleanpageltd@gmail.com</span>
                </div>
                <div className="flex items-center group">
                  <div className="bg-blue-800 p-3 rounded-full mr-4 group-hover:bg-blue-700 transition">
                    <FontAwesomeIcon icon={faPhoneAlt} className="text-xl" />
                  </div>
                  <span className="text-lg"> 0705588354 </span>
                </div>
                <div className="flex items-center group">
                  <div className="bg-blue-800 p-3 rounded-full mr-4 group-hover:bg-blue-700 transition">
                    <FontAwesomeIcon icon={faMapMarkerAlt} className="text-xl" />
                  </div>
                  <span className="text-lg">Nairobi, Kenya</span>
                </div>
              </div>
            </div>

            <div className="lg:w-1/3 reveal-element delay-200">
              <h3 className="text-2xl font-bold mb-6 text-blue-300">Business Hours</h3>
              <div className="bg-gray-800 p-6 rounded-2xl shadow-lg">
                <div className="space-y-4 mb-8">
                  <div className="flex justify-between border-b border-gray-700 pb-2">
                    <span>Monday - Friday</span>
                    <span className="font-bold text-blue-300">8:00 AM - 6:00 PM</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-700 pb-2">
                    <span>Saturday</span>
                    <span className="font-bold text-blue-300">9:00 AM - 4:00 PM</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Sunday</span>
                    <span className="font-bold text-red-400">Closed</span>
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Follow Us</h4>
                  <div className="flex space-x-4">
                    <a href="#" className="w-10 h-10 flex items-center justify-center bg-blue-700 rounded-full hover:bg-blue-600 transition hover:-translate-y-1 transform">
                      <FontAwesomeIcon icon={faFacebookF} />
                    </a>
                    <a href="#" className="w-10 h-10 flex items-center justify-center bg-blue-700 rounded-full hover:bg-blue-600 transition hover:-translate-y-1 transform">
                      <FontAwesomeIcon icon={faTwitterT} />
                    </a>
                    <a href="#" className="w-10 h-10 flex items-center justify-center bg-blue-700 rounded-full hover:bg-blue-600 transition hover:-translate-y-1 transform">
                      <FontAwesomeIcon icon={faInstagramI} />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-950 text-white py-8 border-t border-gray-800">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-sm text-gray-400">
              &copy; {currentYear} Clean Page. All rights reserved.
            </div>
            <div className="mt-4 md:mt-0 flex space-x-6 text-sm text-gray-400">
              <a href="#" className="hover:text-white transition">Privacy Policy</a>
              <a href="#" className="hover:text-white transition">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}