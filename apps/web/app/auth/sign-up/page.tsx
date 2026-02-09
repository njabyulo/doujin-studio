import { SignUpForm } from "~/features/auth/components/sign-up-form";

interface SignUpPageProps {
  searchParams?: Promise<{ next?: string }>;
}

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const resolved = searchParams ? await searchParams : undefined;
  return <SignUpForm next={resolved?.next} />;
}
