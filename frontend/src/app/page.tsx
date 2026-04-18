"use client";
import React from 'react';
import Home from '../pages/Home';
import Navbar from '../components/navbar/Navbar';
import { ThemeProviderWrapper } from '@/providers/ThemeProvider';

export default function HomePage() {
  return (
    <ThemeProviderWrapper>
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-100">
      <Navbar />
      <Home />
    </div>
    </ThemeProviderWrapper>
  );
}