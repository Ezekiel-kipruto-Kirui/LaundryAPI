import * as React from 'react';
import { useState, useEffect } from 'react';
import "bootstrap-icons/font/bootstrap-icons.css";
import { ROUTES } from "@/services/Routes";

export default function LaundryLanding() {
  // --- State for Hero Slider ---
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isTextVisible, setIsTextVisible] = useState(true);

  const heroSlides = [
    {
      heading: "Your clothes deserve expert care, freshness, and a gentle touch.",
      subtext: "Carefully washed, expertly cleaned, and perfectly finished every time."
    },
    {
      heading: "Freshness You Can See. Care You Can Trust.",
      subtext: "Delivering spotless results with attention to every detail."
    },
    {
      heading: "Free Pickup & Delivery, Same day Service on all Clothes",
      subtext: "Convenient, fast, and reliable service designed around your schedule"
    }
  ];

  // Hero Slider Logic
  useEffect(() => {
    const interval = setInterval(() => {
      setIsTextVisible(false); // Fade out
      setTimeout(() => {
        setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
        setIsTextVisible(true); // Fade in
      }, 1000); // Wait for fade out to finish
    }, 8000); // Total cycle time

    return () => clearInterval(interval);
  }, []);

  // --- State for Testimonial Carousel ---
  const [testimonialIndex, setTestimonialIndex] = useState(0);

  // UPDATED: Added 'tags' property to each testimonial object to handle dynamic rendering
  const testimonials = [
    {
      title: "Clothes Cleaning Transformation",
      desc: "Clothes transformed from dirty to fresh and vibrant. Stains removed and fabric revitalized for a like-new look.",
      beforeImg: "./dirtyclothes.png",
      afterImg: "./cleanclothes.jpg",
      tags: ["Stain Removal", "Fabric Care", "Deep Wash"]
    },
    {
      title: "Shoes Restored to Perfection",
      desc: "Transform your shoes with our expert services. Sneaker cleaning, leather polishing, and stain removal. Step out fresh and spotless every day!",
      beforeImg: "./dirtshoes.png",
      afterImg: "./new-sneakers.jpg",
      tags: ["Sneaker Cleaning", "Leather Polishing", "Restoration"]
    },
    {
      title: "Bedding Cleaning Transformation",
      desc: "Bedding cleaned from dust, stains, and odors to provide a hygienic and comfortable sleeping surface.",
      beforeImg: "./dirtybeddings.png",
      afterImg: "./cleanbeddings.png",
      tags: ["Dust Mite Removal", "Odor Elimination", "Hygiene"]
    },
    // New Item 1: Ironing
    {
      title: "Professional Ironing Service",
      desc: "From crumpled to crisp. We ensure your clothes are wrinkle-free, neatly pressed, and ready to wear.",
      beforeImg: "./ironing.png",
      afterImg: "./ironing1.png",
      tags: ["Steam Pressing", "Crisp Finish", "Wrinkle Free"]
    },
    // New Item 2: Mattress
    {
      title: "Mattress Deep Cleaning",
      desc: "Eliminate hidden allergens, dust, and stains from your mattress for a healthier sleep environment.",
      beforeImg: "./matressbefore.png",
      afterImg: "./matressafter.jpg",
      tags: ["Deep Clean", "Sanitization", "Stain Removal"]
    }
  ];

  // --- Mobile Menu State ---
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // --- Form Submission State ---
  const [formSubmitted, setFormSubmitted] = useState(false);

  const handleFormSubmit = (e) => {
    e.preventDefault();
    // Simulate form submission
    setFormSubmitted(true);
    setTimeout(() => setFormSubmitted(false), 5000); // Hide message after 5 seconds
  };

  return (
    <div className="font-sans text-slate-600 bg-white selection:bg-[#0db5f7] selection:text-white">
      {/* --- CSS FOR SMOOTH SCROLLING --- */}
      <style>
        {`
          html { scroll-behavior: smooth; scroll-padding-top: 100px; }
          /* Hide scrollbar for cleaner look in slider if needed, though overflow-hidden handles it */
          .no-scrollbar::-webkit-scrollbar { display: none; }
          .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        `}
      </style>

      {/* --- HEADER --- */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm shadow-sm transition-all duration-300">
        <div className="container-fluid container-xl mx-auto px-4 h-20 flex items-center justify-around">
          {/* Logo */}
          <a href="#hero" className="flex items-center gap-3">
            <img
              src="./Clean-apge-logo-2.png"
              alt=""
              className="w-[75px] flex items-center justify-center text-white font-bold text-xl"
            />
            <h1 className="text-2xl font-sm text-[#0db5f7] tracking-tight">Clean Page Laundry</h1>
          </a>
          <div className='flex flex-row-1 items-center'>
            {/* Desktop Nav */}
            <nav className="hidden md:block mr-10">
              <ul className="flex space-x-8">
                {['Home', 'About Us', 'Services', 'Testimonials', 'Contact'].map((item) => (
                  <li key={item}>
                    <a
                      href={`#${item.toLowerCase().replace(' ', '-')}`}
                      className="text-[#0db5f7] hover:text-red-600 transition-colors font-medium text-sm uppercase tracking-wide relative group"
                    >
                      {item}
                      <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-red-600 transition-all group-hover:w-full"></span>
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            {/* WhatsApp Button (Desktop) */}
            <a
              href="https://wa.me/254705588354"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:inline-flex items-center bg-[#0db5f7] hover:bg-[#0ba3e0] text-white px-5 py-2.5 rounded transition-all shadow-lg shadow-[#0db5f7]/30 hover:shadow-[#0db5f7]/50"
            >
              <i className="bi bi-whatsapp mr-2"></i> WhatsApp
            </a>
            <a href={ROUTES.login}
              className="ml-4 hidden md:inline-flex items-center border border-[#0db5f7] text-white bg-[#0db5f7] hover:bg-white hover:text-[#0db5f7] px-5 py-2.5 rounded transition-all font-medium"
            >
              <i className="bi bi-box-arrow-in-right mr-2 text-[18px]"></i>Login
            </a>
          </div>


          {/* Mobile Toggle */}
          <button
            className="md:hidden text-2xl text-slate-800 focus:outline-none p-2"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 py-4 px-4 shadow-xl absolute w-full animate-fade-in-down">
            <ul className="space-y-4">
              {['Home', 'About Us', 'Services', 'Testimonials', 'Contact'].map((item) => (
                <li key={item}>
                  <a
                    href={`#${item.toLowerCase().replace(' ', '-')}`}
                    className="block text-gray-600 hover:text-[#0db5f7] font-medium text-lg py-2"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {item}
                  </a>
                </li>
              ))}
              <li>
                <a href="https://wa.me/254705588354" className="block text-center bg-[#0db5f7] text-white py-3 rounded-xl font-bold shadow-md mt-4">
                  WhatsApp Us
                </a>
              </li>
            </ul>
          </div>
        )}
      </header>

      <main className="main pt-20">
        {/* --- HERO SECTION --- */}
        <section id="hero" className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
          {/* Background */}
          <div className="absolute inset-0 z-0">
            <img
              src="./beautiful-composition-spa-bath-concept.jpg"
              alt="Background"
              className="w-full h-full object-cover scale-105"
            />
            {/* Improved Gradient Overlay for better text readability */}
            <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-transparent z-10"></div>
          </div>

          {/* Content */}
          <div className="container mx-auto px-4 relative z-20 text-left">
            <div className="max-w-3xl">
              <div className={`transition-all duration-1000 transform ${isTextVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
                <span className="inline-block py-1 px-3 rounded-full bg-[#0db5f7]/20 border border-[#0db5f7]/30 text-[#0db5f7] text-sm font-bold tracking-wider mb-6">
                  PREMIUM LAUNDRY SERVICE
                </span>
                <h1
                  className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight"
                  style={{ fontFamily: "'Georgia', serif" }}
                >
                  {heroSlides[currentSlide].heading}
                </h1>
                <p
                  className="text-lg md:text-xl text-gray-300 mb-10 leading-relaxed font-light max-w-2xl border-l-4 border-[#0db5f7] pl-6"
                >
                  {heroSlides[currentSlide].subtext}
                </p>
              </div>
              <div className="mt-8 flex flex-wrap gap-4">
                <a
                  href="#contact"
                  className="inline-flex items-center bg-[#0db5f7] hover:bg-[#0ba3e0] text-white font-bold py-4 px-8 rounded-full transition-all transform hover:-translate-y-1 hover:shadow-[0_10px_20px_rgba(13,181,247,0.3)]"
                >
                  Book Your Laundry Order Now!
                </a>
                <a
                  href="#services"
                  className="inline-flex items-center bg-transparent border-2 border-white text-white hover:bg-white hover:text-slate-900 font-bold py-4 px-8 rounded-full transition-all"
                >
                  View Services
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* --- ABOUT SECTION --- */}
        <section id="about-us" className="py-24 bg-white relative">
          {/* Decorative Element */}
          <div className="absolute top-0 right-0 w-1/3 h-full bg-slate-50 -z-10 hidden lg:block rounded-l-[100px]"></div>

          <div className="container mx-auto px-4">
            <div className="flex flex-col lg:flex-row items-center gap-16">
              {/* Image */}
              <div className="w-full lg:w-1/2 relative group">
                <div className="absolute -inset-4 bg-[#0db5f7]/20 rounded-[2rem] rotate-3 transition-transform group-hover:rotate-6"></div>
                <img
                  src="./view-inside-laundromat-room-with-vintage-decor-washing-machines.jpeg"
                  alt="Laundry Interior"
                  className="rounded-2xl shadow-2xl w-full object-cover h-[500px] relative z-10"
                />
              </div>
              {/* Text */}
              <div className="w-full lg:w-1/2">
                <h2 className="text-4xl font-bold mb-6 text-slate-900">About Us</h2>
                <div className="w-20 h-1.5 bg-[#0db5f7] mb-8 rounded-full"></div>
                <p className="text-lg leading-relaxed text-gray-600 font-serif mb-4">
                  At Clean Page Laundry, we believe fresh, impeccably clean clothes inspire confidence and comfort. For years, families and professionals have trusted us for quality, care, and perfection in every garment. Using gentle expertise and modern technology, we deliver freshness, elegance, and a personal touch to everything we clean.
                  <br /><br />
                  Beyond laundry, we provide carpet washing, sofa set cleaning, mattress deep cleaning, and shoe cleaning, restoring hygiene and lasting comfort to your home and wardrobe.
                  <br /><br />
                  <span className="font-bold text-[#0db5f7]">Clean Page Laundry & Dry Cleaning Services</span> — where care, cleanliness, and quality meet.
                </p>


              </div>
            </div>
          </div>
        </section>

        {/* --- SERVICES SECTION 1 --- */}
        <section id="services" className="py-24 bg-slate-50 relative overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute top-0 left-0 w-full h-full opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>

          <div className="container mx-auto px-4 relative z-10">
            <div className="text-center mb-16 max-w-2xl mx-auto">
              <h2 className="text-4xl font-bold text-slate-900 mb-4">Our Services</h2>
              <p className="text-slate-500 text-lg">Comprehensive laundry solutions tailored to your needs, delivered with care and precision.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* Service Card Component */}
              {[
                {
                  title: "Carpets Cleaning",
                  desc: "Professional carpet washing that removes dirt, stains, and odors—fresh and fast-drying.",
                  img: "./carpetcleaning.jpeg"
                },
                {
                  title: "Sofa Set Cleaning",
                  desc: "Deep cleaning that restores your sofa’s look, removing dust, stains, and grime.",
                  img: "./sofasetcleaning2.jpg"
                },
                {
                  title: "Mattress Deep Cleaning",
                  desc: "Thorough mattress washing to eliminate stains, odors, and allergens for healthier sleep.",
                  img: "./matresscleaning03.jpeg"
                }
              ].map((service, idx) => (
                <div key={idx} className="group bg-white rounded-3xl shadow-lg hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] transition-all duration-500 overflow-hidden flex flex-col h-full border border-slate-100">
                  {/* Image */}
                  <div className="h-64 overflow-hidden relative">
                    <img
                      src={service.img}
                      alt={service.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-500"></div>
                  </div>

                  {/* Content */}
                  <div className="p-8 flex flex-col flex-grow relative">
                    {/* Floating Circle Badge */}
                    <div className="absolute -top-10 right-8 w-16 h-16 bg-white rounded-full shadow-md flex items-center justify-center text-[#0db5f7] text-2xl border-4 border-slate-50 group-hover:scale-110 transition-transform">
                      <i className="bi bi-stars"></i>
                    </div>

                    <h3 className="text-2xl font-bold text-slate-900 mb-3 mt-2 group-hover:text-[#0db5f7] transition-colors">{service.title}</h3>
                    <p className="text-slate-500 leading-relaxed mb-6 flex-grow">
                      {service.desc}
                    </p>

                    <a href="#contact" className="inline-flex items-center text-[#0db5f7] font-bold hover:gap-2 transition-all">
                      Order Now <i className="bi bi-arrow-right ml-1"></i>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* --- SERVICES SECTION 2 --- */}
        <section className="py-24 bg-white">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                {
                  title: "Shoes Cleaning",
                  desc: "Expert shoe cleaning that brings back freshness, brightness, and style.",
                  img: "./shoescleaning (2).png"
                },
                {
                  title: "Fast Drying for Sofas & Mattress",
                  desc: "Quick-dry technology so that your furniture is ready to use as soon as possible.",
                  img: "./fastdryingsofa.jpeg"
                },
                {
                  title: "Clothes Washing ",
                  desc: "Neat, fresh, and well-washed clothes with care.",
                  img: "./washing.jpeg"
                }
              ].map((service, idx) => (
                <div key={idx} className="group bg-white rounded-3xl shadow-lg hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] transition-all duration-500 overflow-hidden flex flex-col h-full border border-slate-100">
                  {/* Image */}
                  <div className="h-64 overflow-hidden relative">
                    <img
                      src={service.img}
                      alt={service.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-500"></div>
                  </div>

                  {/* Content */}
                  <div className="p-8 flex flex-col flex-grow relative">
                    {/* Floating Circle Badge */}
                    <div className="absolute -top-10 right-8 w-16 h-16 bg-white rounded-full shadow-md flex items-center justify-center text-[#0db5f7] text-2xl border-4 border-slate-50 group-hover:scale-110 transition-transform">
                      <i className="bi bi-stars"></i>
                    </div>

                    <h3 className="text-2xl font-bold text-slate-900 mb-3 mt-2 group-hover:text-[#0db5f7] transition-colors">{service.title}</h3>
                    <p className="text-slate-500 leading-relaxed mb-6 flex-grow">
                      {service.desc}
                    </p>

                    <a href="#contact" className="inline-flex items-center text-[#0db5f7] font-bold hover:gap-2 transition-all">
                      Order Now <i className="bi bi-arrow-right ml-1"></i>
                    </a>
                  </div>
                </div>

              ))}
            </div>
          </div>
        </section>

        {/* --- SERVICES SECTION 3 --- */}
        <section className="py-24 bg-slate-50">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                {
                  title: "Dry Cleaning service",
                  desc: "Expert cleaning that brings back freshness, brightness, and style.",
                  img: "./drycleaningimg.png"
                },
                {
                  title: "Ironing",
                  desc: "Quick-drying and proper ironing ready to use as soon as possible.",
                  img: "./ironing.jpg"
                },
                {
                  title: "Clothes Folding",
                  desc: "Neat, fresh, and well-folded clothes with care.",
                  img: "./Folding.jpg"
                }
              ].map((service, idx) => (
                <div key={idx} className="group bg-white rounded-3xl shadow-lg hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] transition-all duration-500 overflow-hidden flex flex-col h-full border border-slate-100">
                  {/* Image */}
                  <div className="h-64 overflow-hidden relative">
                    <img
                      src={service.img}
                      alt={service.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-500"></div>
                  </div>

                  {/* Content */}
                  <div className="p-8 flex flex-col flex-grow relative">
                    {/* Floating Circle Badge */}
                    <div className="absolute -top-10 right-8 w-16 h-16 bg-white rounded-full shadow-md flex items-center justify-center text-[#0db5f7] text-2xl border-4 border-slate-50 group-hover:scale-110 transition-transform">
                      <i className="bi bi-stars"></i>
                    </div>

                    <h3 className="text-2xl font-bold text-slate-900 mb-3 mt-2 group-hover:text-[#0db5f7] transition-colors">{service.title}</h3>
                    <p className="text-slate-500 leading-relaxed mb-6 flex-grow">
                      {service.desc}
                    </p>

                    <a href="#contact" className="inline-flex items-center text-[#0db5f7] font-bold hover:gap-2 transition-all">
                      Order Now <i className="bi bi-arrow-right ml-1"></i>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* --- TESTIMONIALS / PORTFOLIO (Dynamic Rendering) --- */}
        <section id="testimonials" className="py-24 bg-white relative">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <span className="text-[#0db5f7] font-bold tracking-widest uppercase text-sm">Testimonials</span>

            </div>

            {/* Carousel Container */}
            <div className="relative max-w-[1200px] mx-auto overflow-hidden rounded-[2.5rem] ">

              <div
                className="flex transition-transform duration-700 ease-in-out"
                style={{ transform: `translateX(-${testimonialIndex * 100}%)` }}
              >
                {testimonials.map((t, i) => (
                  <div key={i} className="min-w-full px-4">
                    <div className="flex flex-col lg:flex-row items-stretch gap-0 lg:gap-8 bg-white rounded-[3rem] shadow-xl border border-slate-100 overflow-hidden min-h-[500px]">

                      {/* Before/After Images Side */}
                      <div className="w-full lg:w-3/5 flex flex-col sm:flex-row h-[350px] lg:h-auto relative">
                        <div className="w-1/2 h-full relative group">
                          <img src={t.beforeImg} alt="Before" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors"></div>
                          <div className="absolute top-6 left-6 bg-red-500 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg tracking-wider">BEFORE</div>
                        </div>
                        <div className="w-1/2 h-full relative group">
                          <img src={t.afterImg} alt="After" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors"></div>
                          <div className="absolute top-6 left-6 bg-green-500 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg tracking-wider">AFTER</div>
                        </div>
                        {/* Divider Line */}
                        <div className="absolute top-4 bottom-4 left-1/2 w-1 bg-white/50 -translate-x-1/2 hidden sm:block"></div>
                      </div>

                      {/* Text Content Side */}
                      <div className="w-full lg:w-2/5 flex flex-col justify-center px-8 lg:px-16 py-12 bg-slate-50/50">
                        <i className="bi bi-quote text-6xl text-slate-200 absolute top-8 left-8 -z-0"></i>
                        <h4 className="text-3xl font-bold text-slate-900 mb-6 relative z-10">{t.title}</h4>
                        <p className="text-slate-600 text-lg leading-relaxed mb-8 relative z-10 font-serif italic">
                          {t.desc}
                        </p>

                        {/* DYNAMIC TAGS RENDERING */}
                        <div className="space-y-3 relative z-10">
                          {t.tags && t.tags.map((tag, tagIndex) => (
                            <ServiceTag key={tagIndex} text={tag} />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Controls */}
              <div className="flex justify-center items-center gap-4 py-6 bg-slate-50/50 mt-0 border-t border-slate-100">
                <button
                  onClick={() => setTestimonialIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length)}
                  className="w-12 h-12 rounded-full border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-[#0db5f7] transition-colors flex items-center justify-center shadow-sm"
                  aria-label="Previous Testimonial"
                >
                  <i className="bi bi-arrow-left"></i>
                </button>

                <div className="flex gap-2">
                  {testimonials.map((_, idx) => (
                    <button
                      key={idx}
                      className={`h-2 rounded-full transition-all duration-300 ${idx === testimonialIndex ? 'bg-[#0db5f7] w-8' : 'bg-slate-200 w-2'}`}
                      onClick={() => setTestimonialIndex(idx)}
                      aria-label={`Go to testimonial ${idx + 1}`}
                    ></button>
                  ))}
                </div>

                <button
                  onClick={() => setTestimonialIndex((prev) => (prev + 1) % testimonials.length)}
                  className="w-12 h-12 rounded-full bg-[#0db5f7] text-white hover:bg-[#0ba3e0] transition-colors flex items-center justify-center shadow-lg shadow-[#0db5f7]/30"
                  aria-label="Next Testimonial"
                >
                  <i className="bi bi-arrow-right"></i>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* --- CONTACT SECTION --- */}
        <section id="contact" className="py-24 bg-slate-50">
          <div className="container mx-auto px-4">
            <div className="flex flex-col lg:flex-row gap-16">

              {/* Info Column */}
              <div className="w-full lg:w-1/2 space-y-12">
                <div>
                  <h2 className="text-4xl font-bold text-slate-900 mb-4">Location</h2>
                </div>

                <div className="h-[300px] w-full rounded-3xl overflow-hidden shadow-xl">
                  <iframe
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3989.0983895835917!2d36.924776614753516!3d-1.2010039990715866!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x182f10f5d8646535%3A0xc27e427613741d68!2sKahawa%20West%2C%20Nairobi!5e0!3m2!1sen!2ske!4v1689195336622!5m2!1sen!2ske"
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    title="Map"
                    referrerPolicy="no-referrer-when-downgrade"
                    className="grayscale hover:grayscale-0 transition-all duration-500"
                  ></iframe>
                </div>

                <div className="flex flex-col gap-6">
                  <ContactItem icon="bi-geo-alt-fill" title="Visit Us" text="Kahawa West Opposite Jacaranda Police Station,Nairobi" />
                  <ContactItem icon="bi-telephone-fill" title="Call Us" text="+254 705 588 354" />
                  <ContactItem icon="bi-envelope-fill" title="Email Us" text="cleanpageltd@gmail.com" isFull />

                </div>
              </div>

              {/* Form Column */}
              <div className="w-full lg:w-1/2">
                <div className="bg-white p-8 lg:p-12 rounded-xl shadow-2xl relative overflow-hidden ring-1 ring-slate-100">

                  {/* Decorative background elements */}
                  <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                  <div className="absolute bottom-0 left-0 w-32 h-32 bg-cyan-50 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>

                  {/* Success Overlay */}
                  {formSubmitted && (
                    <div className="absolute inset-0 z-30 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center text-center p-8 animate-fade-in">
                      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-500 text-4xl mb-6 shadow-lg shadow-green-100 animate-bounce">
                        <i className="bi bi-check-lg"></i>
                      </div>
                      <h3 className="text-3xl font-bold text-slate-900 mb-2">Message Sent!</h3>

                      <button
                        onClick={() => setFormSubmitted(false)}
                        className="mt-8 px-8 py-3 bg-[#0db5f7] text-white font-bold rounded-full hover:bg-[#0ba3e0] transition-colors shadow-lg shadow-blue-200"
                      >
                        Send Another Message
                      </button>
                    </div>
                  )}

                  {/* Header */}
                  <div className="relative z-10">
                    <h3 className="text-3xl font-bold text-slate-900 mb-3">Send us a message</h3>


                    <form onSubmit={handleFormSubmit} className="space-y-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Name Input */}
                        <div className="space-y-2 group">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider group-focus-within:text-[#0db5f7] transition-colors">Your Name</label>
                          <div className="relative">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#0db5f7] transition-colors">
                              <i className="bi bi-person text-lg"></i>
                            </div>
                            <input
                              type="text"

                              className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-[#0db5f7] focus:ring-4 focus:ring-[#0db5f7]/10 outline-none transition-all placeholder:text-slate-400 text-slate-700 font-medium"
                              required
                            />
                          </div>
                        </div>

                        {/* Email Input */}
                        <div className="space-y-2 group">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider group-focus-within:text-[#0db5f7] transition-colors">Email Address</label>
                          <div className="relative">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#0db5f7] transition-colors">
                              <i className="bi bi-envelope text-lg"></i>
                            </div>
                            <input
                              type="email"

                              className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-[#0db5f7] focus:ring-4 focus:ring-[#0db5f7]/10 outline-none transition-all placeholder:text-slate-400 text-slate-700 font-medium"
                              required
                            />
                          </div>
                        </div>
                      </div>

                      {/* Subject Input */}
                      <div className="space-y-2 group">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider group-focus-within:text-[#0db5f7] transition-colors">Subject</label>
                        <div className="relative">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#0db5f7] transition-colors">
                            <i className="bi bi-chat-quote text-lg"></i>
                          </div>
                          <input
                            type="text"

                            className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-[#0db5f7] focus:ring-4 focus:ring-[#0db5f7]/10 outline-none transition-all placeholder:text-slate-400 text-slate-700 font-medium"
                            required
                          />
                        </div>
                      </div>

                      {/* Message Textarea */}
                      <div className="space-y-2 group">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider group-focus-within:text-[#0db5f7] transition-colors">Your Message</label>
                        <div className="relative">
                          <div className="absolute left-4 top-4 text-slate-400 group-focus-within:text-[#0db5f7] transition-colors">
                            <i className="bi bi-card-text text-lg"></i>
                          </div>
                          <textarea
                            rows={5}

                            className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-[#0db5f7] focus:ring-4 focus:ring-[#0db5f7]/10 outline-none transition-all resize-none placeholder:text-slate-400 text-slate-700 font-medium"
                            required
                          ></textarea>
                        </div>
                      </div>

                      {/* Submit Button */}
                      <button
                        type="submit"
                        className="w-full bg-[#0db5f7] hover:bg-[#0ba3e0] text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-[#0db5f7]/30 hover:shadow-[#0db5f7]/50 transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
                      >
                        <span>Send Message</span>
                        <i className="bi bi-send-fill text-lg"></i>
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* --- FOOTER --- */}
      <footer className="bg-[#0f172a] text-slate-300 pt-20 pb-8 font-sans">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
            {/* Brand Column */}
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center p-2 backdrop-blur-sm border border-white/10">
                  <img src="./Clean-apge-logo-2.png" alt="Clean Page Logo" className="w-full h-full object-contain" />
                </div>
                <span className="text-2xl font-bold text-white tracking-tight">Clean Page</span>
              </div>
              <p className="text-slate-400 leading-relaxed text-sm">
                Redefining laundry and dry cleaning services in Nairobi. Premium care, eco-friendly products, and reliable pickup & delivery.
              </p>
              <div className="flex space-x-3">
                {['facebook', 'twitter', 'instagram', 'linkedin'].map((social) => (
                  <a
                    key={social}
                    href="#"
                    className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-[#0db5f7] hover:text-white transition-all duration-300 hover:scale-110"
                  >
                    <i className={`bi bi-${social}`}></i>
                  </a>
                ))}
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-white font-bold text-lg mb-6 relative inline-block">
                Company
                <span className="absolute -bottom-2 left-0 w-1/2 h-0.5 bg-[#0db5f7]"></span>
              </h4>
              <ul className="space-y-4">
                <li><a href="#hero" className="text-slate-400 hover:text-[#0db5f7] transition-colors">Home</a></li>
                <li><a href="#about-us" className="text-slate-400 hover:text-[#0db5f7] transition-colors">About Us</a></li>
                <li><a href="#services" className="text-slate-400 hover:text-[#0db5f7] transition-colors">Services</a></li>
                <li><a href="#contact" className="text-slate-400 hover:text-[#0db5f7] transition-colors">Contact</a></li>
              </ul>
            </div>

            {/* Services */}
            <div>
              <h4 className="text-white font-bold text-lg mb-6 relative inline-block">
                Services
                <span className="absolute -bottom-2 left-0 w-1/2 h-0.5 bg-[#0db5f7]"></span>
              </h4>
              <ul className="space-y-4">
                {['Wash & Fold', 'Dry Cleaning', 'Carpet Cleaning', 'Sofa & Mattress', 'Shoe Cleaning'].map((service) => (
                  <li key={service}>
                    <a href="#services" className="text-slate-400 hover:text-[#0db5f7] transition-colors flex items-center gap-2 group">
                      
                      {service}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Newsletter / Contact */}
            <div>
              <h4 className="text-white font-bold text-lg mb-6 relative inline-block">
                Contacts
                <span className="absolute -bottom-2 left-0 w-1/2 h-0.5 bg-[#0db5f7]"></span>
              </h4>

              <ul className="space-y-3 text-sm text-slate-400">
                <li className="flex items-center gap-3"><i className="bi bi-geo-alt text-[#0db5f7]"></i> Kahawa West, Nairobi</li>
                <li className="flex items-center gap-3"><i className="bi bi-telephone text-[#0db5f7]"></i> +254 705 588 354</li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-center items-center gap-4 text-sm text-slate-500">
            <p>&copy; {new Date().getFullYear()} <span className="text-[#0db5f7] font-semibold">Clean Page Laundry</span>. All Rights Reserved.</p>
            {/* <div className="flex gap-6">
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            </div> */}
          </div>
        </div>
      </footer>

      {/* --- SCROLL TO TOP --- */}
      <a
        href="#hero"
        className="fixed bottom-8 right-8 w-14 h-14 bg-white text-[#0db5f7] rounded-full shadow-2xl flex items-center justify-center text-2xl z-40 hover:-translate-y-2 hover:shadow-[#0db5f7]/30 transition-all duration-300 border border-slate-100"
        style={{ display: 'var(--scroll-display, none)', opacity: 'var(--scroll-opacity, 0)' }}
        onClick={(e) => {
          e.preventDefault();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      >
        ↑
      </a>
    </div>
  );
}

// --- Helper Components for Cleaner JSX ---

const ServiceTag = ({ text }) => (
  <div className="flex items-center gap-2 text-sm text-slate-600">
    <i className="bi bi-check-circle-fill text-green-500"></i>
    <span>{text}</span>
  </div>
);

const ContactItem = ({ icon, title, text, isFull = false }) => (
  <div className={`bg-white p-6 rounded-2xl shadow-sm border border-slate-100 ${isFull ? 'col-span-1 sm:col-span-2' : ''}`}>
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-[#0db5f7] text-xl shrink-0">
        <i className={`bi ${icon}`}></i>
      </div>
      <div>
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-1">{title}</h3>
        <p className="text-slate-700 font-medium">{text}</p>
      </div>
    </div>
  </div>
);