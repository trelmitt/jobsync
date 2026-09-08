import { Metadata } from "next";
import { redirect } from "next/navigation";
import AuthCard from "@/components/auth/AuthCard";
import db from "@/lib/db";

export const metadata: Metadata = {
  title: "Sign Up",
};

export default async function Signup() {
  const userCount = await db.user.count();
  if (userCount > 0) {
    redirect("/signin");
  }
  return <AuthCard mode="signup" />;
}
