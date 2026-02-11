import { SignUpForm } from "~/features/auth/components/sign-up-form";

interface SignUpPageProps {
  searchParams?: Promise<{ next?: string }>;
}

const SignUpPage = async ({ searchParams }: SignUpPageProps) => {
  const resolved = searchParams ? await searchParams : undefined;
  return <SignUpForm next={resolved?.next} />;
};

export default SignUpPage;
