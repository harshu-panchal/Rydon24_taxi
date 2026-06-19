import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Briefcase, MapPin, Calendar, Clock, User, Mail, Phone, Award, Send, CheckCircle } from 'lucide-react';
import api from '../../../shared/api/axiosInstance';
import toast from 'react-hot-toast';

const CareersPage = () => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    experience: '',
    coverLetter: '',
    resumeUrl: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const res = await api.get('/careers/jobs');
      // The custom response interceptor flattens the response
      const results = res?.results || res?.data?.results || [];
      setJobs(results);
      if (results.length > 0 && window.innerWidth >= 768) {
        setSelectedJob(results[0]);
      }
    } catch (error) {
      console.error('Failed to fetch careers:', error);
      toast.error('Failed to load career listings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedJob) return;

    if (!formData.fullName || !formData.email || !formData.phone || !formData.experience) {
      toast.error('Please fill in all required fields.');
      return;
    }

    try {
      setSubmitting(true);
      await api.post('/careers/applications', {
        jobId: selectedJob.id,
        ...formData,
        experience: Number(formData.experience)
      });
      setSuccess(true);
      toast.success('Application submitted successfully!');
      setFormData({
        fullName: '',
        email: '',
        phone: '',
        experience: '',
        coverLetter: '',
        resumeUrl: ''
      });
    } catch (error) {
      console.error('Submission failed:', error);
      toast.error(error.message || 'Failed to submit application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 bg-white/90 backdrop-blur-md z-50 border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                if (selectedJob && window.innerWidth < 768) {
                  setSelectedJob(null);
                  setShowForm(false);
                } else {
                  navigate(-1);
                }
              }}
              className="p-2 hover:bg-gray-100 rounded-full transition-all cursor-pointer"
            >
              <ArrowLeft size={20} />
            </button>
            <span className="font-bold text-sm uppercase tracking-widest text-gray-800">Careers</span>
          </div>
          <button
            onClick={() => navigate('/')}
            className="text-xs font-bold uppercase tracking-widest text-gray-500 hover:text-slate-900 transition-colors cursor-pointer"
          >
            Home
          </button>
        </div>
      </div>

      {/* Hero Section */}
      <div className="relative bg-[#1a1a1a] text-white pt-36 pb-24 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,179,0,0.12),transparent_45%)]"></div>
        <div className="absolute inset-0 opacity-[0.02] bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        <div className="relative max-w-4xl mx-auto text-center z-10">
          <span className="text-[#FFB300] text-sm font-black uppercase tracking-[0.2em] mb-4 block">
            WE ARE HIRING
          </span>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-6 leading-tight">
            Build the Future of <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FFB300] to-[#FFC43D]">Mobility</span> with Rydon24
          </h1>
          <p className="text-base md:text-lg text-gray-400 leading-relaxed max-w-2xl mx-auto">
            Join a fast-growing, dynamic team dedicated to providing secure, efficient, and modern transit and delivery services.
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 md:py-16">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <span className="w-10 h-10 border-4 border-[#FFB300]/30 border-t-[#FFB300] rounded-full animate-spin"></span>
            <span className="mt-4 text-gray-500 text-sm font-bold">Loading open positions...</span>
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm p-10">
            <Briefcase size={50} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-xl font-bold text-gray-800">No Open Positions</h3>
            <p className="text-gray-500 mt-2 max-w-md mx-auto">
              We don't have any open postings right now. Check back soon or send your resume directly to our support team.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            {/* Left Column: List of Jobs */}
            <div className={`${selectedJob ? 'hidden md:block' : 'block'} md:col-span-5 space-y-6`}>
              <h2 className="text-xl font-black uppercase tracking-wider text-gray-800 mb-2">
                Open Opportunities ({jobs.length})
              </h2>
              <div className="space-y-4">
                {jobs.map((job) => (
                  <div
                    key={job.id}
                    onClick={() => {
                      setSelectedJob(job);
                      setShowForm(false);
                      setSuccess(false);
                    }}
                    className={`p-6 rounded-2xl border transition-all duration-300 cursor-pointer bg-white ${
                      selectedJob?.id === job.id
                        ? 'border-[#FFB300] ring-2 ring-[#FFB300]/25 shadow-md scale-[1.01]'
                        : 'border-gray-100 shadow-sm hover:border-[#FFB300]/50 hover:shadow-md hover:translate-y-[-2px]'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-[#FFB300] mb-3">
                          {job.type}
                        </span>
                        <h3 className="text-lg font-bold text-gray-900 transition-colors">{job.title}</h3>
                        <p className="text-sm font-medium text-gray-500 mt-1">{job.department}</p>
                      </div>
                    </div>
                    <div className="flex gap-4 mt-4 text-xs font-semibold text-gray-400">
                      <span className="flex items-center gap-1">
                        <MapPin size={14} className="text-[#FFB300]" />
                        {job.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar size={14} />
                        {new Date(job.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Job Detail & Form Panel */}
            <div className={`${selectedJob ? 'block' : 'hidden md:block'} md:col-span-7`}>
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-8 sticky top-24">
                {selectedJob ? (
                  <div>
                    {/* Back Button for mobile */}
                    <button
                      onClick={() => {
                        setSelectedJob(null);
                        setShowForm(false);
                      }}
                      className="md:hidden flex items-center gap-2 text-gray-500 hover:text-gray-900 font-bold text-xs uppercase tracking-wider mb-6 transition-colors cursor-pointer"
                    >
                      <ArrowLeft size={16} />
                      <span>Back to Listings</span>
                    </button>

                    {!showForm ? (
                      /* Job Details Mode */
                      <div>
                        <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 mb-3">
                          {selectedJob.type}
                        </span>
                        <h3 className="text-2xl md:text-3xl font-black text-gray-900 leading-tight">{selectedJob.title}</h3>
                        <div className="flex flex-wrap gap-x-6 gap-y-2.5 my-5 pb-5 border-b border-gray-100 text-xs font-semibold text-gray-500">
                          <p className="flex items-center gap-2">
                            <Briefcase size={14} className="text-[#FFB300]" />
                            <span>Department: {selectedJob.department}</span>
                          </p>
                          <p className="flex items-center gap-2">
                            <MapPin size={14} className="text-[#FFB300]" />
                            <span>Location: {selectedJob.location}</span>
                          </p>
                        </div>
                        <div className="text-sm text-gray-600 leading-relaxed space-y-4 whitespace-pre-line max-h-[60vh] md:max-h-[calc(100vh-24rem)] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
                          {selectedJob.description}
                        </div>
                        <button
                          onClick={() => setShowForm(true)}
                          className="mt-6 w-full py-4 bg-[#FFB300] hover:bg-[#E5A100] active:scale-95 text-slate-900 font-bold rounded-xl text-xs uppercase tracking-wider transition-all shadow-md shadow-amber-500/10 cursor-pointer"
                        >
                          Apply For This Job
                        </button>
                      </div>
                    ) : success ? (
                      /* Success Submission View */
                      <div className="text-center py-12 md:py-16">
                        <CheckCircle className="mx-auto text-emerald-500 mb-4 animate-bounce" size={54} />
                        <h3 className="text-xl font-bold text-gray-900">Application Submitted!</h3>
                        <p className="text-gray-500 text-sm mt-3 max-w-[280px] mx-auto leading-relaxed">
                          Thank you for applying to the <strong>{selectedJob.title}</strong> role. Our hiring team will review your application soon.
                        </p>
                        <button
                          onClick={() => {
                            setShowForm(false);
                            setSuccess(false);
                          }}
                          className="mt-8 px-8 py-3 border border-gray-200 hover:border-slate-800 hover:bg-slate-50 text-xs font-bold rounded-xl transition-all uppercase tracking-wider cursor-pointer"
                        >
                          Back to Details
                        </button>
                      </div>
                    ) : (
                      /* Application Form Mode */
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h3 className="text-xl font-black uppercase tracking-tight text-gray-800">
                              Apply Now
                            </h3>
                            <p className="text-xs text-gray-400 font-semibold mt-1">
                              Position: {selectedJob.title}
                            </p>
                          </div>
                          <button
                            onClick={() => setShowForm(false)}
                            className="hidden md:block text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors uppercase tracking-wider cursor-pointer"
                          >
                            View Details
                          </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                              Full Name *
                            </label>
                            <div className="relative">
                              <User className="absolute left-3.5 top-3 text-gray-400" size={16} />
                              <input
                                type="text"
                                name="fullName"
                                required
                                value={formData.fullName}
                                onChange={handleInputChange}
                                placeholder="Your full name"
                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#FFB300] focus:ring-1 focus:ring-[#FFB300] text-sm transition-all outline-none bg-gray-50/50"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                                Email Address *
                              </label>
                              <div className="relative">
                                <Mail className="absolute left-3.5 top-3 text-gray-400" size={16} />
                                <input
                                  type="email"
                                  name="email"
                                  required
                                  value={formData.email}
                                  onChange={handleInputChange}
                                  placeholder="email@example.com"
                                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#FFB300] focus:ring-1 focus:ring-[#FFB300] text-sm transition-all outline-none bg-gray-50/50"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                                Phone Number *
                              </label>
                              <div className="relative">
                                <Phone className="absolute left-3.5 top-3 text-gray-400" size={16} />
                                <input
                                  type="tel"
                                  name="phone"
                                  required
                                  value={formData.phone}
                                  onChange={handleInputChange}
                                  placeholder="Phone number"
                                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#FFB300] focus:ring-1 focus:ring-[#FFB300] text-sm transition-all outline-none bg-gray-50/50"
                                />
                              </div>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                              Years of Experience *
                            </label>
                            <div className="relative">
                              <Award className="absolute left-3.5 top-3 text-gray-400" size={16} />
                              <input
                                type="number"
                                name="experience"
                                required
                                min="0"
                                max="50"
                                value={formData.experience}
                                onChange={handleInputChange}
                                placeholder="e.g. 3"
                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#FFB300] focus:ring-1 focus:ring-[#FFB300] text-sm transition-all outline-none bg-gray-50/50"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                              Cover Letter / Note (Optional)
                            </label>
                            <textarea
                              name="coverLetter"
                              rows="3"
                              value={formData.coverLetter}
                              onChange={handleInputChange}
                              placeholder="Introduce yourself briefly..."
                              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#FFB300] focus:ring-1 focus:ring-[#FFB300] text-sm transition-all outline-none bg-gray-50/50 resize-none"
                            ></textarea>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                              Resume / Portfolio Link (Optional)
                            </label>
                            <input
                              type="url"
                              name="resumeUrl"
                              value={formData.resumeUrl}
                              onChange={handleInputChange}
                              placeholder="https://drive.google.com/... or github.com/..."
                              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#FFB300] focus:ring-1 focus:ring-[#FFB300] text-sm transition-all outline-none bg-gray-50/50"
                            />
                          </div>

                          <div className="flex gap-3 pt-2">
                            <button
                              type="button"
                              onClick={() => setShowForm(false)}
                              className="flex-1 py-3 border border-gray-200 hover:bg-gray-50 font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={submitting}
                              className="flex-1 py-3 bg-[#FFB300] hover:bg-[#E5A100] active:scale-95 disabled:opacity-50 text-slate-900 font-bold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer"
                            >
                              {submitting ? 'Sending...' : (
                                <>
                                  <Send size={12} />
                                  <span>Submit</span>
                                </>
                              )}
                            </button>
                          </div>
                        </form>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <Briefcase size={44} className="mx-auto text-gray-300 mb-4" />
                    <h3 className="text-lg font-bold text-gray-800 mb-1">Select a Position</h3>
                    <p className="text-xs font-semibold text-gray-400 max-w-[240px] mx-auto leading-relaxed">
                      Select a job position from the list on the left to view details and apply.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CareersPage;
