import React, { useState } from "react";
import axios from "axios";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

function App() {
  const [stockName, setStockName] = useState("AAPL");
  const [stockData, setStockData] = useState(null);
  const [newsData, setNewsData] = useState(null);
  const [relatedCompanies, setRelatedCompanies] = useState(null);
  const [error, setError] = useState(null);
  const [maxSentiment, setMaxSentiment] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setStockData(null);
    setNewsData(null);
    setMaxSentiment(null);
    setRelatedCompanies(null);

    try {
      const [stockResponse, newsResponse, relatedCompaniesResponse] =
        await Promise.all([
          axios.get(
            `https://api.polygon.io/v3/reference/tickers/${stockName.toUpperCase()}`,
            {
              params: {
                apiKey: process.env.REACT_APP_POLYGON_API_KEY,
              },
            }
          ),
          axios.get(`https://api.polygon.io/v2/reference/news`, {
            params: {
              ticker: stockName.toUpperCase(),
              apiKey: process.env.REACT_APP_POLYGON_API_KEY,
            },
          }),
          axios.get(
            `https://api.polygon.io/v1/related-companies/${stockName.toUpperCase()}`,
            {
              params: {
                apiKey: process.env.REACT_APP_POLYGON_API_KEY,
              },
            }
          ),
        ]);

      if (
        stockResponse.data.error ||
        newsResponse.data.error ||
        relatedCompaniesResponse.data.error
      ) {
        throw new Error(
          stockResponse.data.error ||
            newsResponse.data.error ||
            relatedCompaniesResponse.data.error
        );
      }

      const stockData = stockResponse.data.results;
      const newsData = newsResponse.data.results;
      const relatedCompanies = relatedCompaniesResponse.data.results;

      setStockData({
        ticker: stockData.ticker,
        name: stockData.name,
        market_cap: stockData.market_cap,
        description: stockData.description,
        homepage_url: stockData.homepage_url,
        icon_url: stockData.branding?.icon_url,
      });

      // Perform sentiment analysis on the news articles
      const sentimentPromises = newsData.map((article) =>
        analyzeSentiment(article.article_url)
      );
      const sentimentResults = await Promise.all(sentimentPromises);

      const newsWithSentiment = newsData.map((article, index) => ({
        ...article,
        sentiment: sentimentResults[index],
      }));

      setNewsData(newsWithSentiment);

      // Find the document with the maximum positive or negative sentiment score
      const maxSentimentDoc = findMaxSentimentDocument(newsWithSentiment);
      setMaxSentiment(maxSentimentDoc);

      setRelatedCompanies(relatedCompanies);
    } catch (err) {
      setError(err.message || "Error fetching stock data or news");
    }
  };

  const analyzeSentiment = async (url) => {
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_AZURE_ENDPOINT}/text/analytics/v3.1/sentiment`,
        {
          documents: [
            {
              id: "1",
              language: "en",
              text: url,
            },
          ],
        },
        {
          headers: {
            "Ocp-Apim-Subscription-Key": process.env.REACT_APP_AZURE_API_KEY,
            "Content-Type": "application/json",
          },
        }
      );

      const sentimentData = response.data.documents[0].confidenceScores;
      return sentimentData;
    } catch (error) {
      console.error("Error analyzing sentiment:", error);
      return null;
    }
  };

  const findMaxSentimentDocument = (newsWithSentiment) => {
    let maxDoc = null;

    newsWithSentiment.forEach((article) => {
      if (!maxDoc) {
        maxDoc = article;
      } else {
        const maxValue = Math.max(
          maxDoc.sentiment.positive,
          maxDoc.sentiment.negative
        );
        const currentMaxValue = Math.max(
          article.sentiment.positive,
          article.sentiment.negative
        );
        if (currentMaxValue > maxValue) {
          maxDoc = article;
        }
      }
    });

    return maxDoc;
  };

  const getSentimentChartData = (sentiment) => {
    return {
      labels: ["Positive", "Neutral", "Negative"],
      datasets: [
        {
          data: [sentiment.positive, sentiment.neutral, sentiment.negative],
          backgroundColor: ["#4caf50", "#ffeb3b", "#f44336"],
        },
      ],
    };
  };

  return (
    <div className="flex flex-col h-screen">
      <nav className="flex items-center justify-between bg-blue-500 p-4">
        <h1 className="text-white text-2xl font-bold">
          Stock Sentiment Analysis
        </h1>
        <form onSubmit={handleSubmit} className="flex items-center space-x-4">
          <input
            type="text"
            value={stockName}
            onChange={(e) => setStockName(e.target.value)}
            placeholder="Enter stock name"
            className="p-2 border border-gray-300 rounded text-black"
          />
          <button
            type="submit"
            className="bg-white text-green-700 px-4 py-2 border-2 border-gray-500 rounded-lg hover:bg-gray-200"
          >
            Submit
          </button>
        </form>
      </nav>

      <div className="flex flex-1 overflow-hidden ">
        <aside className="w-1/4 p-4 overflow-y-auto">
          {stockData && (
            <section className="mb-6">
              <h2 className="text-2xl font-bold mb-6 text-center">{stockData.name}</h2>
              {/* {stockData.icon_url && <img src={stockData.icon_url} alt={`${stockData.name} logo`} className="mb-4" />} */}

              <div className="p-4 border border-gray-300 rounded-lg bg-gray-300">

              <p>
                <strong>Ticker:</strong> {stockData.ticker}
              </p>
              <br />
              <p>
                <strong>Market Cap:</strong> {stockData.market_cap}
              </p>
              <br />
              <p>
                <strong>Description:</strong> {stockData.description}
              </p>
              <br />
              {stockData.homepage_url && (
                <p>
                  <strong>Homepage:</strong>{" "}
                  <a
                    href={stockData.homepage_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500"
                  >
                    {stockData.homepage_url}
                  </a>
                </p>
                )}
                </div>
            </section>
          )}
          {error && <p className="text-red-500">{error}</p>}
        </aside>

        <main className="flex-1 bg-gray-100 p-6 overflow-y-auto flex flex-col">
          {maxSentiment && (
            <section className="mb-6">
              <h2 className="text-2xl font-bold mb-4 text-center">
                Most Significant Sentiment
              </h2>
              <div className="p-4 border border-gray-300 bg-gray-300 rounded-lg pb-10">
                <h3 className="text-lg font-semibold">{maxSentiment.title}</h3>
                <p>{new Date(maxSentiment.published_utc).toLocaleString()}</p>
                <p>{maxSentiment.summary}</p>
                <a
                  href={maxSentiment.article_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500"
                >
                  Read more
                </a>
                {maxSentiment.sentiment && (
                  <div
                    className="mt-4"
                    style={{ width: "500px", height: "500px" }}
                  >
                    {/* <p>
                      <strong>Sentiment Chart :</strong>
                    </p> */}
                    <Doughnut
                      data={getSentimentChartData(maxSentiment.sentiment)}
                    />
                  </div>
                )}
              </div>
            </section>
          )}

          <div className="absolute right-7 top-31">
            {relatedCompanies && (
              <section>
                <h2 className="text-2xl font-bold mb-6">Related Companies</h2>
                <ul className="space-y-2">
                  {relatedCompanies.map((company) => (
                    <li
                      key={company.ticker}
                      className="text-center bg-gray-100 rounded shadow"
                    >
                      <p>
                        <strong></strong> {company.ticker}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
