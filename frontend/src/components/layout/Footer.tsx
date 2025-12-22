import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-white mt-16">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          
          {/* Brand Column */}
          <div className="md:col-span-2 lg:col-span-1">
            <div className="mb-4">
              <span className="text-2xl font-bold text-blue-400">LetsRevise</span>
            </div>
            <p className="text-gray-300 text-sm mb-4">
              Your premier platform for UK curriculum resources.
            </p>
            <div className="flex space-x-3">
              <a href="#" className="text-gray-400 hover:text-white text-sm">
                Facebook
              </a>
              <a href="#" className="text-gray-400 hover:text-white text-sm">
                Twitter
              </a>
              <a href="#" className="text-gray-400 hover:text-white text-sm">
                Instagram
              </a>
              <a href="#" className="text-gray-400 hover:text-white text-sm">
                LinkedIn
              </a>
            </div>
          </div>

          {/* Curriculum Column */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-blue-300">Curriculum</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/curriculum/a-level" className="text-gray-300 hover:text-blue-400 text-sm">
                  A-Level
                </Link>
              </li>
              <li>
                <Link to="/curriculum/gcse" className="text-gray-300 hover:text-blue-400 text-sm">
                  GCSE
                </Link>
              </li>
              <li>
                <Link to="/curriculum/ks3" className="text-gray-300 hover:text-blue-400 text-sm">
                  KS3
                </Link>
              </li>
            </ul>
          </div>

          {/* Subjects Column */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-blue-300">Subjects</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/subjects/mathematics" className="text-gray-300 hover:text-blue-400 text-sm">
                  Mathematics
                </Link>
              </li>
              <li>
                <Link to="/subjects/sciences" className="text-gray-300 hover:text-blue-400 text-sm">
                  Sciences
                </Link>
              </li>
              <li>
                <Link to="/subjects/languages" className="text-gray-300 hover:text-blue-400 text-sm">
                  Languages
                </Link>
              </li>
            </ul>
          </div>

          {/* Account Column */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-blue-300">Account</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/dashboard" className="text-gray-300 hover:text-blue-400 text-sm">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link to="/rivisecoins" className="text-gray-300 hover:text-blue-400 text-sm">
                  ShamCoins
                </Link>
              </li>
              <li>
                <Link to="/settings" className="text-gray-300 hover:text-blue-400 text-sm">
                  Settings
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Contact Info */}
        <div className="mt-8 pt-8 border-t border-gray-800">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-gray-400 text-sm mb-4 md:mb-0">
              <p>Email: support@letsrevise.com</p>
              <p>Phone: +44 (0)20 1234 5678</p>
              <p>Location: London, United Kingdom</p>
            </div>
            <div className="flex space-x-6">
              <Link to="/privacy" className="text-gray-400 hover:text-white text-sm">
                Privacy Policy
              </Link>
              <Link to="/terms" className="text-gray-400 hover:text-white text-sm">
                Terms of Service
              </Link>
              <Link to="/cookies" className="text-gray-300 hover:text-white text-sm">
                Cookie Policy
              </Link>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-6 pt-6 border-t border-gray-800">
          <div className="text-center">
            <p className="text-gray-500 text-xs">
              © {currentYear} LetsRevise. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;