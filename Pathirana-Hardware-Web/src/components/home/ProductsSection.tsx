import { Container } from "@/components/ui/Container";
import { InView } from "@/components/ui/InView";
import { HomeEyebrow } from "./HomeEyebrow";
import { HomeCategoryCards } from "./HomeCategoryCards";
import { T } from "@/i18n/I18nProvider";

export function ProductsSection() {
  return (
    <section aria-labelledby="products-title" className="bg-cream py-16 lg:py-20">
      <Container size="wide">
        <InView className="reveal-group">
          <div className="text-center">
            <div className="rv">
              <HomeEyebrow>Our products</HomeEyebrow>
            </div>
            <h2
              id="products-title"
              className="rv d1 mt-4 font-display text-3xl leading-tight font-semibold text-forest sm:text-4xl lg:text-[2.6rem]"
            >
              <T>Everything for Your Building Needs</T>
            </h2>
          </div>

          <HomeCategoryCards />
        </InView>
      </Container>
    </section>
  );
}
