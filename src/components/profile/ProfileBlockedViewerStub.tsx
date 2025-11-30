import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const ProfileBlockedViewerStub = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <Navbar />
      <main className="section-container py-8 md:py-10">
        <Card className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-sm">
          <CardContent className="space-y-4 px-6 py-6">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold text-slate-900">This angler isn&apos;t available.</h1>
              <p className="text-sm text-slate-600">You can&apos;t view this angler&apos;s profile.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild variant="outline" className="rounded-full px-4">
                <Link to="/feed">Back to feed</Link>
              </Button>
              <Button asChild variant="ghost" className="rounded-full px-4">
                <Link to="/venues">Browse venues</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ProfileBlockedViewerStub;
