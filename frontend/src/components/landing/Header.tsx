import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X, Sun, Moon, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, actualTheme, setTheme } = useTheme();

  const navLinks = [
    { name: "Pricing", href: "/pricing" },
    { name: "FAQs", href: "/faqs" },
    { name: "Blog", href: "#blog" },
  ];

  const handleLinkClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string
  ) => {
    if (href.startsWith("#")) {
      e.preventDefault();
      const element = document.querySelector(href);
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
    }
    setMobileMenuOpen(false);
  };

  const cycleTheme = () => {
    const themes: Array<"light" | "dark" | "system"> = [
      "light",
      "dark",
      "system",
    ];
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  const getThemeIcon = () => {
    switch (theme) {
      case "light":
        return <Sun className="h-4 w-4" />;
      case "dark":
        return <Moon className="h-4 w-4" />;
      case "system":
        return <Monitor className="h-4 w-4" />;
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full pt-4">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex h-14 items-center justify-between bg-black rounded-full px-6">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <img
                src="/privexbot-logo-icon.png"
                alt="Privexbot"
                className="h-6 w-6 filter brightness-0 invert"
              />
              <span className="text-lg font-semibold font-manrope text-white">
                Privexbot
              </span>
            </Link>
            <span className="text-gray-500 text-sm mx-4">|</span>
          </div>

          {/* Desktop Navigation - Centered */}
          <div className="hidden md:flex md:items-center md:justify-center absolute left-1/2 transform -translate-x-1/2">
            <div className="flex items-center">
              {navLinks.map((link, index) => (
                <div key={link.name} className="flex items-center">
                  <Link
                    to={link.href.startsWith("#") ? "/" : link.href}
                    onClick={(e) => handleLinkClick(e, link.href)}
                    className="text-sm font-medium font-manrope text-white hover:text-gray-300 transition-colors duration-200 px-4"
                  >
                    {link.name}
                  </Link>
                  {index < navLinks.length - 1 && (
                    <span className="text-gray-500 text-sm">|</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Desktop Auth Buttons */}
          <div className="hidden md:flex md:items-center md:space-x-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={cycleTheme}
              title={`Theme: ${theme}`}
              className="text-white hover:text-gray-300 bg-transparent hover:bg-gray-800"
            >
              {getThemeIcon()}
            </Button>
            <span className="text-gray-500 text-sm">|</span>
            <Link to="/login">
              <Button
                variant="ghost"
                className="font-manrope text-white hover:text-gray-300 bg-transparent hover:bg-transparent px-4"
              >
                Login
              </Button>
            </Link>
            <Link to="/signin">
              <Button className="font-manrope bg-blue-600 hover:bg-blue-700 text-white rounded-full px-6 py-2">
                Start for free
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </nav>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-4">
            <div className="bg-black rounded-2xl px-6 py-4 border-t border-gray-700">
              <div className="flex flex-col space-y-4">
                {navLinks.map((link) => (
                  <Link
                    key={link.name}
                    to={link.href.startsWith("#") ? "/" : link.href}
                    onClick={(e) => handleLinkClick(e, link.href)}
                    className="text-sm font-medium font-manrope text-white hover:text-gray-300 transition-colors"
                  >
                    {link.name}
                  </Link>
                ))}
                <div className="flex flex-col space-y-2 pt-4 border-t border-gray-700">
                  <Button
                    variant="outline"
                    onClick={cycleTheme}
                    className="w-full justify-start font-manrope bg-transparent border-gray-600 text-white hover:bg-gray-800"
                  >
                    {getThemeIcon()}
                    <span className="ml-2 capitalize">Theme: {theme}</span>
                  </Button>
                  <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                    <Button
                      variant="ghost"
                      className="w-full font-manrope text-white hover:text-gray-300 bg-transparent hover:bg-gray-800"
                    >
                      Login
                    </Button>
                  </Link>
                  <Link to="/signin" onClick={() => setMobileMenuOpen(false)}>
                    <Button className="w-full font-manrope bg-blue-600 hover:bg-blue-700 text-white rounded-full">
                      Start for free
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
