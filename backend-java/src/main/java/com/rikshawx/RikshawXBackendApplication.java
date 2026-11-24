package com.rikshawx;

import com.rikshawx.config.AppProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(AppProperties.class)
public class RikshawXBackendApplication {
  public static void main(String[] args) {
    SpringApplication.run(RikshawXBackendApplication.class, args);
  }
}
