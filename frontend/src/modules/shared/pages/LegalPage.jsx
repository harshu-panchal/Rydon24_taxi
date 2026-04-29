import React, { useEffect, useState } from 'react';
import { ArrowLeft, FileText, ShieldCheck, Scale, ScrollText } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

const getLegalContent = () => ({
  terms: {
    title: 'Terms & Conditions',
    icon: <ScrollText size={24} />,
    intro: `Effective Date: 29 April 2026\n\nWelcome to Rydon24 (“Company”, “we”, “our”, “us”). These Terms & Conditions govern your access to and use of the Rydon24 website, mobile application, and services including taxi booking, bike rental, parcel delivery, and related transportation solutions.\n\nBy using our platform, you agree to be bound by these Terms.`,
    sections: [
      {
        title: '1. About Rydon24',
        content: `Rydon24 is a digital mobility platform that connects users with transport partners for:\n\n• Taxi booking\n• Bike rental\n• Parcel delivery\n• Scheduled transportation services\n• Future mobility services introduced by the platform`
      },
      {
        title: '2. Eligibility',
        content: `To use our services, you must:\n\n• Be at least 18 years old\n• Be legally capable of entering into binding contracts\n• Provide accurate registration details\n• Hold a valid driving license for bike rental services`
      },
      {
        title: '3. User Account',
        content: `Users may register through:\n\n• Mobile number with OTP verification\n• Email address\n• Social login (if available)\n\nYou are responsible for:\n\n• Maintaining account confidentiality\n• Activities under your account\n• Accurate personal information\n\nRydon24 may suspend accounts containing false, misleading, or suspicious information.`
      },
      {
        title: '4. Services',
        content: `4.1 Taxi Booking\nUsers can book:\n• Local city rides\n• One-way rides\n• Round trips\n• Airport transfers\n• Hourly packages\n• Corporate rides (if available)\n\nImportant Note:\nEstimated fare may vary depending on: Traffic, Route changes, Waiting time, Tolls, Government taxes.\n\n4.2 Bike Rental\nUsers may rent two-wheelers through the platform.\nRequirements:\n• Valid driving license\n• Security deposit (if applicable)\n• Timely return of vehicle\n• Compliance with traffic laws\nUser will be responsible for: Challans/fines during rental period, Damage caused during rental use, Fuel charges (if policy applicable).\n\n4.3 Parcel Delivery\nUsers may send eligible parcels.\nAllowed Items: Documents, Clothing, Electronics (non-fragile, at own risk), Daily-use goods.\nRestricted / Prohibited Items: Weapons, Explosives, Narcotics, Illegal substances, Dangerous chemicals, Cash / valuables without declaration, Live animals.\n\nRydon24 reserves the right to inspect or reject parcels.`
      },
      {
        title: '5. Booking Confirmation',
        content: `A booking is considered confirmed only after:\n\n• Driver/partner acceptance OR\n• Successful system confirmation\n\nRydon24 cannot guarantee immediate availability at all times.`
      },
      {
        title: '6. Payments',
        content: `Accepted payment methods may include:\n\n• UPI\n• Debit/Credit Cards\n• Net Banking\n• Wallets\n• Cash (where enabled)\n\nUsers authorize Rydon24 to collect applicable charges including: Base fare, Distance charges, Waiting charges, Toll/Parking, Taxes, Convenience fee, Late fee (bike rental).`
      },
      {
        title: '7. Cancellation Policy',
        content: `Taxi\n• Free cancellation may apply within limited time\n• Late cancellation may attract fee\n\nBike Rental\n• Cancellation fee may depend on booking time and vehicle blocking period\n\nParcel Delivery\n• Cancellation after pickup may be non-refundable`
      },
      {
        title: '8. Refund Policy',
        content: `Eligible refunds will be processed within 5 to 10 business days to original payment method, subject to banking timelines.`
      },
      {
        title: '9. User Conduct',
        content: `You agree not to:\n\n• Abuse drivers or staff\n• Damage vehicle/property\n• Create fake bookings\n• Use services for unlawful activity\n• Provide false parcel information\n• Attempt fraud or payment reversal misuse\n\nViolation may result in suspension or permanent ban.`
      },
      {
        title: '10. Driver / Partner Conduct',
        content: `Rydon24 expects all partners to maintain professionalism and safety standards.\n\nUsers may report:\n\n• Misbehavior\n• Unsafe driving\n• Overcharging\n• Delay issues\n• Fraud attempts`
      },
      {
        title: '11. Delays & Service Interruptions',
        content: `We are not liable for delays caused by:\n\n• Traffic congestion\n• Weather conditions\n• Road closures\n• Law enforcement checks\n• Strikes\n• Technical downtime\n• Force majeure events`
      },
      {
        title: '12. Limitation of Liability',
        content: `Rydon24 operates as a technology platform facilitating service access.\n\nTo the maximum extent permitted by law, Rydon24 shall not be liable for:\n\n• Indirect damages\n• Missed appointments\n• Personal items left in vehicle\n• Third-party incidents\n• User negligence\n\nAny direct liability, where applicable, shall be limited to the booking amount paid.`
      },
      {
        title: '13. Safety Guidelines',
        content: `Users should:\n\n• Verify vehicle and driver details before ride\n• Wear helmet/seatbelt\n• Avoid sharing OTP except for legitimate verification\n• Use emergency support where available`
      },
      {
        title: '14. Intellectual Property',
        content: `All trademarks, logos, software, design, content, and branding of Rydon24 remain exclusive property of the Company.\n\nUnauthorized copying or use is prohibited.`
      },
      {
        title: '15. Suspension / Termination',
        content: `We may suspend or terminate accounts for:\n\n• Fraud\n• Chargebacks abuse\n• Misconduct\n• Repeated cancellations\n• Policy violations\n• Legal requests`
      },
      {
        title: '16. Governing Law',
        content: `These Terms shall be governed by the laws of India.`
      },
      {
        title: '17. Contact Information',
        content: `Support Email: support@rydon24.com\nWebsite: www.rydon24.com`
      }
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    icon: <ShieldCheck size={24} />,
    intro: `Effective Date: 29 April 2026\n\nRydon24 respects your privacy. This Privacy Policy explains how we collect, use, store, and protect your information.`,
    sections: [
      {
        title: '1. Information We Collect',
        content: `Personal Information:\n• Full Name\n• Mobile Number\n• Email Address\n• Profile details\n\nBooking Information:\n• Pickup and drop locations\n• Ride history\n• Rental dates\n• Parcel sender/receiver information\n\nDevice Information:\n• Device type\n• Browser type\n• App version\n• IP address\n\nLocation Data:\nWe may collect live location during active rides/bookings for operational and safety purposes.`
      },
      {
        title: '2. How We Use Information',
        content: `We use your data to:\n\n• Process bookings\n• Connect users with drivers/partners\n• Improve route matching\n• Customer support\n• Fraud prevention\n• Notifications / OTP\n• Analytics and service improvement`
      },
      {
        title: '3. Payment Information',
        content: `Payments are processed through secure third-party payment gateways.\n\nRydon24 does not store complete debit/credit card details.`
      },
      {
        title: '4. Sharing of Information',
        content: `We may share limited data with:\n\n• Drivers / delivery partners\n• Payment processors\n• SMS / email providers\n• Analytics vendors\n• Government authorities where legally required`
      },
      {
        title: '5. Data Security',
        content: `We use commercially reasonable measures such as:\n\n• Encryption\n• Secure APIs\n• OTP verification\n• Access restrictions\n\nHowever, no system is fully immune from cyber threats.`
      },
      {
        title: '6. Cookies & Tracking',
        content: `Website/app may use cookies or similar technologies for:\n\n• Login sessions\n• Preferences\n• Performance tracking\n• Analytics`
      },
      {
        title: '7. Data Retention',
        content: `We retain data as necessary for:\n\n• Legal compliance\n• Tax records\n• Dispute resolution\n• Fraud prevention\n• Business operations`
      },
      {
        title: '8. User Rights',
        content: `Subject to law, users may request:\n\n• Access to personal data\n• Correction of data\n• Account deletion request\n• Withdrawal of promotional consent`
      },
      {
        title: '9. Children’s Privacy',
        content: `Rydon24 services are not intended for users below 18 years of age.`
      },
      {
        title: '10. Third-Party Links',
        content: `Our platform may contain links to third-party websites. We are not responsible for their privacy practices.`
      },
      {
        title: '11. Policy Updates',
        content: `We may revise this Privacy Policy periodically. Continued use of services means acceptance of updated policy.`
      },
      {
        title: '12. Contact Us',
        content: `Privacy Email: privacy@rydon24.com\nSupport Email: support@rydon24.com`
      }
    ],
  },
  refund: {
    title: 'Refund Policy',
    icon: <Scale size={24} />,
    intro: `Effective Date: 29 April 2026\n\nThis policy explains how refunds are processed at Rydon24.`,
    sections: [
      {
        title: 'Refund Eligibility',
        content: `Eligible refunds will be processed within 5 to 10 business days to original payment method, subject to banking timelines.\n\nRefunds may be applicable in cases of:\n• System errors resulting in overcharging\n• Service not provided as booked (subject to verification)\n• Cancellations within the free cancellation window`
      }
    ]
  },
  cancellation: {
    title: 'Cancellation Policy',
    icon: <FileText size={24} />,
    intro: `Effective Date: 29 April 2026\n\nPlease read our cancellation guidelines carefully before making a booking.`,
    sections: [
      {
        title: 'Taxi',
        content: `• Free cancellation may apply within limited time\n• Late cancellation may attract fee`
      },
      {
        title: 'Bike Rental',
        content: `• Cancellation fee may depend on booking time and vehicle blocking period`
      },
      {
        title: 'Parcel Delivery',
        content: `• Cancellation after pickup may be non-refundable`
      }
    ]
  }
});

const getDocumentType = (pathname = '') => {
  const p = pathname.toLowerCase();
  if (p.includes('privacy')) return 'privacy';
  if (p.includes('refund')) return 'refund';
  if (p.includes('cancellation')) return 'cancellation';
  return 'terms';
};

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

  const content = getLegalContent()[getDocumentType(location.pathname)];

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
            <p className="text-gray-500 text-lg font-medium leading-relaxed whitespace-pre-line">
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
              <div className="text-[16px] font-medium leading-relaxed text-gray-600 whitespace-pre-line">
                {section.content}
              </div>
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
