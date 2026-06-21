"use client";

import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const testimonials = [
  {
    name: "Rohan Patil",
    role: "Computer Engineering, COEP",
    content:
      "BlackBook AI saved me weeks of work. I uploaded my project files and got a perfectly formatted blackbook that my guide approved on the first review.",
    rating: 5,
    initials: "RP",
  },
  {
    name: "Priya Sharma",
    role: "Information Technology, VIT",
    content:
      "The knowledge graph feature is incredible. It actually understands your project structure and generates chapters that are coherent and technically accurate.",
    rating: 5,
    initials: "PS",
  },
  {
    name: "Amit Kumar",
    role: "Mechanical Engineering, IIT",
    content:
      "As a guide, I recommend BlackBook AI to all my students. The quality validation ensures no hallucinations or incorrect technical content.",
    rating: 5,
    initials: "AK",
  },
  {
    name: "Sneha Deshmukh",
    role: "Electronics, SPPU",
    content:
      "The GitHub integration is a game changer. It analyzed my entire repo and generated implementation chapters that perfectly matched my code structure.",
    rating: 5,
    initials: "SD",
  },
];

export function TestimonialsSection() {
  return (
    <section id="testimonials" className="px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl font-bold text-white sm:text-4xl"
          >
            Loved by students and{" "}
            <span className="text-blue-400">faculty alike</span>
          </motion.h2>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-2">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="rounded-2xl border border-[#222] bg-[#111] p-6"
            >
              <div className="flex gap-1">
                {Array.from({ length: testimonial.rating }).map((_, i) => (
                  <Star
                    key={i}
                    className="h-4 w-4 fill-yellow-500 text-yellow-500"
                  />
                ))}
              </div>
              <p className="mt-4 text-sm leading-relaxed text-white/60">
                &ldquo;{testimonial.content}&rdquo;
              </p>
              <div className="mt-6 flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-[#222] text-sm text-white">
                    {testimonial.initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="text-sm font-medium text-white">
                    {testimonial.name}
                  </div>
                  <div className="text-xs text-white/40">
                    {testimonial.role}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
