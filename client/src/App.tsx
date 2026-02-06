import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import PlayPage from "@/pages/play";
import StemPage from "@/pages/stem";

function Router() {
  return (
    <Switch>
      <Route path="/view" component={Home} />
      <Route path="/play" component={PlayPage} />
      <Route path="/stem" component={StemPage} />
      <Route path="/">
        <Redirect to="/view" />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
