"use client";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet";
import { GoogleLogin } from '@react-oauth/google';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { jwtDecode } from "jwt-decode";
import apiClient from "@/services/api";
import { registerUser } from "@/services/accounts";


export const LoginForm = () => {
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const givenNameRef = useRef<HTMLInputElement>(null);
  const surnameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const signUpEmailRef = useRef<HTMLInputElement>(null);
  const signUpPasswordRef = useRef<HTMLInputElement>(null);
  const passwordConfirmRef = useRef<HTMLInputElement>(null);
  const { login } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const email = emailRef.current?.value;
    const password = passwordRef.current?.value;

    if (email && password) {
      try {
        const response = await apiClient.post("/api/accounts/login/", { email, password });
        if (response.data) {
          console.log("Login response data:", response.data);
          const user = response.data.user;
          const access_token = response.data.access;
          const refresh_token = response.data.refresh;
          login(user, access_token, refresh_token);
          router.push('/'); // Redirect to home page
        }
      } catch (err) {
        setError("Login failed. Please check your credentials.");
        console.error("Login failed", err);
      }
    } else {
      setError("Please enter email and password.");
    }
  };

  async function fetchGoogleUserInfo(accessToken: any) {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) throw new Error('Failed to fetch user info');
    const data = await res.json();
    return data;
  }

  const handleGoogleLogin = async (decodedData: any) => {
    try {
      const response = await apiClient.post("/api/accounts/login/google/direct/", {
        name: decodedData.name,
        email: decodedData.email,
        google_id: decodedData.sub
      });
      if (response.data) {
        const user = response.data.user;
        const access_token = response.data.access;
        const refresh_token = response.data.refresh;

        login(user, access_token, refresh_token);
        router.push('/'); // Redirect to home page
      }
    } catch (err) {
      setError("Google login failed. Please try again.");
      console.error("Google login failed", err);
    }
  }

  const createUserAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const givenName = givenNameRef.current?.value;
    const surname = surnameRef.current?.value;
    const phone = phoneRef.current?.value;
    const email = signUpEmailRef.current?.value;
    const password = signUpPasswordRef.current?.value;
    const passwordConfirm = passwordConfirmRef.current?.value;

    if (password !== passwordConfirm) {
      setError("Passwords do not match.");
      return;
    }

    if (givenName && surname && phone && email && password) {
      try {
        await registerUser({
          name: `${givenName} ${surname}`,
          phone_number: phone,
          email: email,
          password: password,
        });
        setError(null);
        alert("Account created successfully! Please log in.");
      } catch (err) {
        setError("Account creation failed. Please try again.");
        console.error("Account creation failed", err);
      }
    } else {
      setError("Please fill all fields.");
    }
  };

  return (
    <form onSubmit={handleLogin} className="w-full">
      {error && <p className="text-red-500 text-center mb-4">{error}</p>}
      <div className="grid gap-4 py-4">
        <div className="flex-col flex space-y-2">
          <Label htmlFor="email" className="text-right text-black/50">
            Email
          </Label>
          <Input
            ref={emailRef}
            id="email"
            type="email"
            className="col-span-3 h-12 text-black border-black/20 shadow-none"
          />
        </div>
        <div className="flex-col flex space-y-2">
          <Label htmlFor="password" className="text-right text-black/50">
            Password
          </Label>
          <Input
            ref={passwordRef}
            id="password"
            type="password"
            className="col-span-3 h-12 text-black border-black/20 shadow-none"
          />
        </div>
      </div>
      <Button
        type="submit"
        className="w-full h-14 hover:bg-chart-4 text-md hover:text-black cursor-pointer"
      >
        Sign In
      </Button>
      <GoogleOAuthProvider clientId="72436171717-kfa8bjgv5tputt0ddecl7hfdguj4d2k1.apps.googleusercontent.com">
        <GoogleLogin
          onSuccess={credentialResponse => {
            if (!credentialResponse?.credential) return;
            const decodedData = jwtDecode(credentialResponse?.credential);
            handleGoogleLogin(decodedData);
          }}
          onError={() => {

          }}
          useOneTap
        />
      </GoogleOAuthProvider>
      <div className="mt-4 text-center text-sm">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="link" className="text-black p-0 h-auto">
              Don&apos;t have an account? Sign up
            </Button>
          </SheetTrigger>
          <SheetContent
            side="top"
            className="w-[calc(100%-20px)] sm:w-fit top-1/2 left-1/2 -translate-1/2 h-fit p-5 pb-14 rounded-xl shadow-[0_0_0_100vw_rgba(0,0,0,0.6)] bg-white px-8 sm:px-14"
          >
            <SheetHeader className="px-0">
              <SheetTitle className="text-black text-2xl">
                Sign Up
              </SheetTitle>
              <SheetDescription>
                Enter your credentials to create an account.
              </SheetDescription>
            </SheetHeader>
            <form className="grid gap-4 py-4" onSubmit={createUserAccount}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex-col flex space-y-2">
                  <Label
                    htmlFor="given-name-mobile"
                    className="text-black/50"
                  >
                    Given Name
                  </Label>
                  <Input
                    ref={givenNameRef}
                    id="given-name-mobile"
                    placeholder="Given Name"
                    required
                    className="h-12 text-black border-black/20 shadow-none"
                  />
                </div>
                <div className="flex-col flex space-y-2">
                  <Label
                    htmlFor="surname-mobile"
                    className="text-black/50"
                  >
                    Surname
                  </Label>
                  <Input
                    ref={surnameRef}
                    id="surname-mobile"
                    placeholder="Surname"
                    required
                    className="h-12 text-black border-black/20 shadow-none"
                  />
                </div>
              </div>

              <div className="flex-col flex space-y-2">
                <Label
                  htmlFor="tel-mobile"
                  className="text-black/50"
                >
                  Mobile Phone Number
                </Label>
                <div className="flex items-center">
                  <span className="inline-flex items-center px-3 h-12 rounded-l-md border border-r-0 border-black/20 bg-gray-50 text-gray-500 text-sm">
                    🇺🇬 +256
                  </span>
                  <Input
                    ref={phoneRef}
                    id="tel-mobile"
                    type="tel"
                    placeholder="771 234567"
                    required
                    className="h-12 rounded-l-none text-black border-black/20 shadow-none"
                  />
                </div>
              </div>

              <div className="flex-col flex space-y-2">
                <Label
                  htmlFor="email-Sign Up-mobile"
                  className="text-black/50"
                >
                  Email
                </Label>
                <Input
                  ref={signUpEmailRef}
                  id="email-Sign Up-mobile"
                  type="email"
                  placeholder="Email"
                  required
                  className="h-12 text-black border-black/20 shadow-none"
                />
              </div>

              <div className="flex-col flex space-y-2">
                <Label
                  htmlFor="password-Sign Up-mobile"
                  className="text-black/50"
                >
                  Password
                </Label>
                <Input
                  ref={signUpPasswordRef}
                  id="password-Sign Up-mobile"
                  type="password"
                  placeholder="Password"
                  required
                  className="h-12 text-black border-black/20 shadow-none"
                />
              </div>

              <div className="flex-col flex space-y-2">
                <Label
                  htmlFor="password-confirm-mobile"
                  className="text-black/50"
                >
                  Re-enter Your Password
                </Label>
                <Input
                  ref={passwordConfirmRef}
                  id="password-confirm-mobile"
                  type="password"
                  placeholder="Re-enter Your Password"
                  required
                  className="h-12 text-black border-black/20 shadow-none"
                />
              </div>
              <p className="terms-text text-xs sm:col-span-2">
                By creating an account, I agree to the{" "}
                <a href="#">Terms and Conditions</a> and{" "}
                <a href="#">Privacy Policy</a>.
              </p>
              <Button
                type="submit"
                className="w-full h-14 hover:bg-chart-4 text-md hover:text-black cursor-pointer sm:col-span-2"
              >
                Sign Up
              </Button>
              <GoogleOAuthProvider clientId="72436171717-kfa8bjgv5tputt0ddecl7hfdguj4d2k1.apps.googleusercontent.com">
                <GoogleLogin
                  onSuccess={credentialResponse => {
                    if (!credentialResponse?.credential) return;
                    const decodedData = jwtDecode(credentialResponse?.credential);
                    handleGoogleLogin(decodedData);
                  }}
                  onError={() => {

                  }}
                  useOneTap
                />
              </GoogleOAuthProvider>

            </form>
          </SheetContent>
        </Sheet>
      </div>
    </form>
  );
};
