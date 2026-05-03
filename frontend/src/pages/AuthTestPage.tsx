/**
 * Authentication Test Page
 *
 * Testing page to verify all authentication features work correctly:
 * - Email/password forms with validation
 * - Wallet detection and connection
 * - Password strength validation
 * - Responsive design
 * - Error handling
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Smartphone,
  Monitor,
  Tablet,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Eye,
  Code,
  Palette,
  Shield
} from "lucide-react";
import { WalletButton } from "@/components/auth/WalletButton";
import { PasswordField } from "@/components/auth/PasswordField";
import { detectWallets } from "@/lib/wallet-utils";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function AuthTestPage() {
  const [activeTest, setActiveTest] = useState("components");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [walletDetection, setWalletDetection] = useState(detectWallets());
  const [viewportSize, setViewportSize] = useState("desktop");

  const handleRefreshWallets = () => {
    setWalletDetection(detectWallets());
  };

  const handleWalletTest = (walletId: string) => {
    alert(`Testing wallet: ${walletId}`);
  };

  const getViewportStyles = () => {
    switch (viewportSize) {
      case "mobile":
        return "max-w-sm";
      case "tablet":
        return "max-w-md";
      case "desktop":
        return "max-w-lg";
      default:
        return "max-w-lg";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950 dark:via-indigo-950 dark:to-purple-950">
      {/* Header */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to Home
          </Link>
          <h1 className="text-xl font-bold">Authentication Test Suite</h1>
          <Link
            to="/login"
            className="text-sm text-primary hover:underline"
          >
            Go to Login
          </Link>
        </div>
      </div>

      <div className="container mx-auto px-4 pb-8">
        <div className="grid lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="space-y-4 sticky top-8">
              <h2 className="font-semibold text-lg">Test Categories</h2>

              <nav className="space-y-2">
                <Button
                  variant={activeTest === "components" ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setActiveTest("components")}
                >
                  <Palette className="h-4 w-4 mr-2" />
                  Components
                </Button>

                <Button
                  variant={activeTest === "wallets" ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setActiveTest("wallets")}
                >
                  <Shield className="h-4 w-4 mr-2" />
                  Wallet Detection
                </Button>

                <Button
                  variant={activeTest === "responsive" ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setActiveTest("responsive")}
                >
                  <Monitor className="h-4 w-4 mr-2" />
                  Responsive Design
                </Button>

                <Button
                  variant={activeTest === "validation" ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setActiveTest("validation")}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Form Validation
                </Button>
              </nav>

              {/* Viewport Size Selector */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Viewport Size</Label>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={viewportSize === "mobile" ? "default" : "outline"}
                    onClick={() => setViewportSize("mobile")}
                  >
                    <Smartphone className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant={viewportSize === "tablet" ? "default" : "outline"}
                    onClick={() => setViewportSize("tablet")}
                  >
                    <Tablet className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant={viewportSize === "desktop" ? "default" : "outline"}
                    onClick={() => setViewportSize("desktop")}
                  >
                    <Monitor className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <motion.div
              key={activeTest}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className={cn("mx-auto space-y-8", getViewportStyles())}
            >
              {/* Components Test */}
              {activeTest === "components" && (
                <div className="space-y-8">
                  <div className="text-center">
                    <h2 className="text-2xl font-bold mb-2">Component Tests</h2>
                    <p className="text-muted-foreground">
                      Test all authentication components and their interactions
                    </p>
                  </div>

                  {/* Password Field Test */}
                  <div className="bg-white dark:bg-gray-900 p-6 rounded-lg border">
                    <h3 className="text-lg font-semibold mb-4">Password Field Component</h3>
                    <PasswordField
                      id="test-password"
                      label="Test Password"
                      value={password}
                      onChange={setPassword}
                      showStrength={true}
                      placeholder="Type to test password validation"
                    />
                  </div>

                  {/* Form Components */}
                  <div className="bg-white dark:bg-gray-900 p-6 rounded-lg border">
                    <h3 className="text-lg font-semibold mb-4">Form Components</h3>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="test-email">Email</Label>
                        <Input
                          id="test-email"
                          type="email"
                          placeholder="test@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="h-11"
                        />
                      </div>

                      <Button className="w-full h-11">
                        <Eye className="h-4 w-4 mr-2" />
                        Test Button
                      </Button>
                    </div>
                  </div>

                  {/* Alert Examples */}
                  <div className="bg-white dark:bg-gray-900 p-6 rounded-lg border">
                    <h3 className="text-lg font-semibold mb-4">Alert States</h3>
                    <div className="space-y-4">
                      <Alert>
                        <CheckCircle2 className="h-4 w-4" />
                        <AlertDescription>Success message example</AlertDescription>
                      </Alert>

                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>Error message example</AlertDescription>
                      </Alert>
                    </div>
                  </div>
                </div>
              )}

              {/* Wallet Detection Test */}
              {activeTest === "wallets" && (
                <div className="space-y-8">
                  <div className="text-center">
                    <h2 className="text-2xl font-bold mb-2">Wallet Detection Tests</h2>
                    <p className="text-muted-foreground">
                      Test wallet detection, connection, and installation guidance
                    </p>
                  </div>

                  <div className="flex justify-center">
                    <Button onClick={handleRefreshWallets} variant="outline">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh Detection
                    </Button>
                  </div>

                  {/* Detected Wallets */}
                  {walletDetection.installed.length > 0 && (
                    <div className="bg-white dark:bg-gray-900 p-6 rounded-lg border">
                      <div className="flex items-center gap-2 mb-4">
                        <h3 className="text-lg font-semibold">Detected Wallets</h3>
                        <Badge variant="secondary">{walletDetection.installed.length}</Badge>
                      </div>
                      <div className="space-y-3">
                        {walletDetection.installed.map((wallet) => (
                          <WalletButton
                            key={wallet.id}
                            wallet={wallet}
                            onClick={() => handleWalletTest(wallet.id)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Not Installed Wallets */}
                  {walletDetection.notInstalled.length > 0 && (
                    <div className="bg-white dark:bg-gray-900 p-6 rounded-lg border">
                      <div className="flex items-center gap-2 mb-4">
                        <h3 className="text-lg font-semibold">Not Installed</h3>
                        <Badge variant="outline">{walletDetection.notInstalled.length}</Badge>
                      </div>
                      <div className="space-y-3">
                        {walletDetection.notInstalled.map((wallet) => (
                          <WalletButton
                            key={wallet.id}
                            wallet={wallet}
                            onClick={() => handleWalletTest(wallet.id)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Detection Summary */}
                  <div className="bg-white dark:bg-gray-900 p-6 rounded-lg border">
                    <h3 className="text-lg font-semibold mb-4">Detection Summary</h3>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold text-green-600">
                          {walletDetection.installed.length}
                        </div>
                        <div className="text-sm text-muted-foreground">Detected</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-orange-600">
                          {walletDetection.notInstalled.length}
                        </div>
                        <div className="text-sm text-muted-foreground">Not Installed</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-blue-600">
                          {walletDetection.recommended.length}
                        </div>
                        <div className="text-sm text-muted-foreground">Recommended</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Responsive Design Test */}
              {activeTest === "responsive" && (
                <div className="space-y-8">
                  <div className="text-center">
                    <h2 className="text-2xl font-bold mb-2">Responsive Design Tests</h2>
                    <p className="text-muted-foreground">
                      Test how components adapt to different screen sizes
                    </p>
                  </div>

                  <div className="bg-white dark:bg-gray-900 p-6 rounded-lg border">
                    <h3 className="text-lg font-semibold mb-4">
                      Current Viewport: {viewportSize}
                    </h3>

                    <Tabs defaultValue="login" className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="login">Login</TabsTrigger>
                        <TabsTrigger value="signup">Signup</TabsTrigger>
                      </TabsList>

                      <TabsContent value="login" className="space-y-4 mt-6">
                        <div className="space-y-4">
                          <div>
                            <Label>Email</Label>
                            <Input placeholder="you@example.com" className="h-11" />
                          </div>
                          <div>
                            <Label>Password</Label>
                            <Input type="password" placeholder="••••••••" className="h-11" />
                          </div>
                          <Button className="w-full h-11">Sign In</Button>
                        </div>
                      </TabsContent>

                      <TabsContent value="signup" className="space-y-4 mt-6">
                        <div className="space-y-4">
                          <div>
                            <Label>Username</Label>
                            <Input placeholder="alice_wonderland" className="h-11" />
                          </div>
                          <div>
                            <Label>Email</Label>
                            <Input placeholder="you@example.com" className="h-11" />
                          </div>
                          <PasswordField
                            id="responsive-password"
                            label="Password"
                            value=""
                            onChange={() => {}}
                            showStrength={true}
                          />
                          <Button className="w-full h-11">Create Account</Button>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>
                </div>
              )}

              {/* Validation Test */}
              {activeTest === "validation" && (
                <div className="space-y-8">
                  <div className="text-center">
                    <h2 className="text-2xl font-bold mb-2">Form Validation Tests</h2>
                    <p className="text-muted-foreground">
                      Test various validation states and error handling
                    </p>
                  </div>

                  <div className="bg-white dark:bg-gray-900 p-6 rounded-lg border">
                    <h3 className="text-lg font-semibold mb-4">Password Validation</h3>
                    <div className="space-y-6">
                      <PasswordField
                        id="weak-password"
                        label="Weak Password (try: 'test')"
                        value=""
                        onChange={() => {}}
                        showStrength={true}
                      />

                      <PasswordField
                        id="strong-password"
                        label="Strong Password (try: 'TestPassword123!')"
                        value=""
                        onChange={() => {}}
                        showStrength={true}
                      />
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-900 p-6 rounded-lg border">
                    <h3 className="text-lg font-semibold mb-4">Error States</h3>
                    <div className="space-y-4">
                      <div>
                        <Label>Email with Error</Label>
                        <Input
                          placeholder="invalid-email"
                          className="border-red-500 focus-visible:ring-red-500"
                        />
                        <p className="text-sm text-red-600 mt-1">Please enter a valid email address</p>
                      </div>

                      <div>
                        <Label>Username with Success</Label>
                        <Input
                          placeholder="valid_username"
                          className="border-green-500 focus-visible:ring-green-500"
                        />
                        <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
                          <CheckCircle2 className="h-4 w-4" />
                          Username is available
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation Links */}
              <div className="bg-white dark:bg-gray-900 p-6 rounded-lg border">
                <h3 className="text-lg font-semibold mb-4">Test Navigation</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Link to="/login">
                    <Button variant="outline" className="w-full">
                      <Code className="h-4 w-4 mr-2" />
                      New Login Page
                    </Button>
                  </Link>

                  <Link to="/signin">
                    <Button variant="outline" className="w-full">
                      <Code className="h-4 w-4 mr-2" />
                      New Signup Page
                    </Button>
                  </Link>

                  <Link to="/auth/login">
                    <Button variant="ghost" className="w-full">
                      <Code className="h-4 w-4 mr-2" />
                      Old Login Page
                    </Button>
                  </Link>

                  <Link to="/auth/signin">
                    <Button variant="ghost" className="w-full">
                      <Code className="h-4 w-4 mr-2" />
                      Old Signup Page
                    </Button>
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}