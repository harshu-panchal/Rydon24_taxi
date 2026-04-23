import React, { useEffect, useState } from 'react';
import { ArrowLeft, FileText, ShieldCheck, Scale, ScrollText } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

const getLegalContent = (appName) => ({
  terms: {
    title: 'Terms of Service',
    icon: <ScrollText size={24} />,
    intro: `Welcome to ${appName}. These terms govern your use of our platform and services. By using ${appName}, you agree to these rules.`,
    sections: [
      {
        title: '1. User Responsibilities',
        content: 'Users must provide accurate personal, contact, and payment information. You are responsible for all activity under your account.'
      },
      {
        title: '2. Service Usage',
        content: `Our platform facilitates on-demand mobility services. ${appName} does not provide transportation but connects you with independent drivers.`
      },
      {
        title: '3. Safety & Conduct',
        content: 'We maintain a zero-tolerance policy for harassment or unsafe behavior. Violation of safety protocols may result in account termination.'
      },
      {
        title: '4. Payments & Refunds',
        content: 'Fare estimates are provided upfront. Final charges include distance, time, and applicable surcharges. Refunds are handled on a case-by-case basis.'
      }
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    icon: <ShieldCheck size={24} />,
    intro: `At ${appName}, we value your privacy. This policy outlines how we collect, use, and protect your personal data while using our app.`,
    sections: [
      {
        title: '1. Data Collection',
        content: 'We collect location data, phone numbers, and profile information to provide our services and ensure safety during every trip.'
      },
      {
        title: '2. Usage Tracking',
        content: 'Real-time location is tracked during active rides for routing, fair calculation, and security monitoring by our support team.'
      },
      {
        title: '3. Document Security',
        content: 'KYC documents and profile photos are stored securely and used only for identity verification and regulatory compliance.'
      },
      {
        title: '4. Third-Party Sharing',
        content: 'We do not sell your personal data. Information is shared only with drivers for ride fulfillment or as required by legal authorities.'
      }
    ],
  },
});

const getDocumentType = (pathname = '') => (pathname.toLowerCase().includes('privacy') ? 'privacy' : 'terms');

const LegalPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [appName, setAppName] = useState('App');

  useEffect(() => {
    const title = document.title;
    if (title && title !== 'App') {
      setAppName(title);
    }
  }, []);

  const content = getLegalContent(appName)[getDocumentType(location.pathname)];

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900 selection:bg-black selection:text-white">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md z-50 border-bottom border-gray-100">
        <div className="max-w-xl mx-auto px-6 h-16 flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-50 rounded-full transition-all"
            >
              <ArrowLeft size={20} />
            </button>
            <span className="font-bold text-sm uppercase tracking-widest text-gray-400">Legal Center</span>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-6 pt-24 pb-20">
        {/* Intro Section */}
        <div className="mb-12">
            <div className="w-16 h-16 bg-black text-white rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-black/10">
                {content.icon}
            </div>
            <h1 className="text-4xl font-black tracking-tight mb-4">{content.title}</h1>
            <p className="text-gray-500 text-lg font-medium leading-relaxed">
                {content.intro}
            </p>
        </div>

        {/* Content Sections */}
        <div className="space-y-10">
          {content.sections.map((section, idx) => (
            <div key={idx} className="group">
              <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 transition-colors group-hover:text-black">
                {section.title}
              </h3>
              <p className="text-[16px] font-medium leading-relaxed text-gray-600">
                {section.content}
              </p>
            </div>
          ))}
        </div>

        {/* Footer info */}
        <div className="mt-20 pt-10 border-t border-gray-50 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-300">
                Last Updated: April 2026 • © {appName} Technologies
            </p>
        </div>
      </div>
    </div>
  );
};

export default LegalPage;
