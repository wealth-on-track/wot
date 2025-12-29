import { Navbar } from "@/components/Navbar";
import { RegisterForm } from "@/components/RegisterForm";
import { Suspense } from "react";

export default function RegisterPage() {
    return (
        <>
            <Suspense fallback={<div className="h-16 bg-white/5 backdrop-blur-md" />}>
                <Navbar />
            </Suspense>
            <div className="flex-center" style={{ minHeight: '80vh' }}>
                <RegisterForm />
            </div>
        </>
    );
}
