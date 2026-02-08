import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import PlayPage from "@/pages/play";
import StemPage from "@/pages/stem";
import SearchPage from "@/pages/search";

function Router() {
  return (
    <Switch>
      <Route path="/view/config" component={Home} />
      <Route path="/view">{() => <Home standalone />}</Route>
      <Route path="/play/config" component={PlayPage} />
      <Route path="/play">{() => <PlayPage standalone />}</Route>
      <Route path="/stem" component={StemPage} />
      <Route path="/search" component={SearchPage} />
      <Route path="/">
        <Redirect to="/view/config" />
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
