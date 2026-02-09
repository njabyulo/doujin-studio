import { SignInForm } from "~/features/auth/components/sign-in-form";

interface SignInPageProps {
  searchParams?: Promise<{ next?: string }>;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const resolved = searchParams ? await searchParams : undefined;
  return <SignInForm next={resolved?.next} />;
}
