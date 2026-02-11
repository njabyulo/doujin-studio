import { SignInForm } from "~/features/auth/components/sign-in-form";

interface SignInPageProps {
  searchParams?: Promise<{ next?: string }>;
}

const SignInPage = async ({ searchParams }: SignInPageProps) => {
  const resolved = searchParams ? await searchParams : undefined;
  return <SignInForm next={resolved?.next} />;
};

export default SignInPage;
