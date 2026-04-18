"use client";
import React from 'react';
import Navbar from '../../components/navbar/Navbar';
import CampanhasNew from '../../pages/CampanhasNew';
import { ThemeProviderWrapper } from '@/providers/ThemeProvider';

export default function CampaignsPage() {
  return (
    <ThemeProviderWrapper>
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-100">
      <Navbar />
      <CampanhasNew />
    </div>
    </ThemeProviderWrapper>
  );
}